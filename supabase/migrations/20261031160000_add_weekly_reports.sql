-- Forward-only migration. Production rollback requires a new migration.

alter table public.account_preferences
  add column weekly_report_enabled boolean not null default true;

grant update (weekly_report_enabled)
  on table public.account_preferences to authenticated;

create table public.weekly_reports (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  week_start date not null,
  attempts integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  primary key (tenant_id, week_start)
);

alter table public.weekly_reports enable row level security;
revoke all on table public.weekly_reports from anon;
revoke all on table public.weekly_reports from authenticated;

comment on table public.weekly_reports is
  'One row per tenant and ISO week: makes the Monday report idempotent.';

create or replace function public.claim_weekly_reports(
  p_now timestamptz default clock_timestamp()
)
returns table (
  tenant_id uuid,
  week_start date,
  email text,
  display_name text,
  monitors_total integer,
  incidents_opened integer,
  incidents_open_now integer,
  pings_7d bigint,
  fails_7d bigint,
  problem_monitors jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_week date;
  since timestamptz;
  candidate record;
begin
  -- Reports go out on Monday from 09:00 UTC; the cron retries every minute.
  if extract(isodow from (p_now at time zone 'utc')) <> 1
    or extract(hour from (p_now at time zone 'utc')) < 9 then
    return;
  end if;

  current_week := (p_now at time zone 'utc')::date;
  since := p_now - interval '7 days';

  for candidate in
    select
      membership.tenant_id as tenant,
      account.email as owner_email,
      preferences.display_name as owner_name
    from public.tenant_memberships as membership
    join auth.users as account
      on account.id = membership.user_id
    left join public.account_preferences as preferences
      on preferences.tenant_id = membership.tenant_id
    left join public.weekly_reports as report
      on report.tenant_id = membership.tenant_id
      and report.week_start = current_week
    where membership.role = 'owner'
      and coalesce(preferences.weekly_report_enabled, true)
      and exists (
        select 1 from public.monitors as monitor
        where monitor.tenant_id = membership.tenant_id
      )
      and (
        report.tenant_id is null
        or (
          report.sent_at is null
          and report.attempts < 3
          and report.last_attempt_at < p_now - interval '10 minutes'
        )
      )
    for update of membership skip locked
  loop
    insert into public.weekly_reports as stored (
      tenant_id, week_start, attempts, last_attempt_at
    )
    values (candidate.tenant, current_week, 1, p_now)
    on conflict on constraint weekly_reports_pkey do update
    set
      attempts = stored.attempts + 1,
      last_attempt_at = p_now;

    tenant_id := candidate.tenant;
    week_start := current_week;
    email := candidate.owner_email;
    display_name := candidate.owner_name;

    select count(*)::integer
    into monitors_total
    from public.monitors as monitor
    where monitor.tenant_id = candidate.tenant;

    select count(*)::integer
    into incidents_opened
    from public.incidents as incident
    where incident.tenant_id = candidate.tenant
      and incident.opened_at >= since;

    select count(*)::integer
    into incidents_open_now
    from public.incidents as incident
    where incident.tenant_id = candidate.tenant
      and incident.resolved_at is null;

    select
      coalesce(sum(stats.pings), 0)::bigint,
      coalesce(sum(stats.fails), 0)::bigint
    into pings_7d, fails_7d
    from public.monitor_daily_stats as stats
    where stats.tenant_id = candidate.tenant
      and stats.day >= (since at time zone 'utc')::date;

    select coalesce(jsonb_agg(ranked.item order by ranked.incidents desc), '[]'::jsonb)
    into problem_monitors
    from (
      select
        count(*) as incidents,
        jsonb_build_object(
          'id', monitor.id,
          'incidents', count(*),
          'name', monitor.name
        ) as item
      from public.incidents as incident
      join public.monitors as monitor
        on monitor.id = incident.monitor_id
      where incident.tenant_id = candidate.tenant
        and incident.opened_at >= since
      group by monitor.id, monitor.name
      order by count(*) desc
      limit 5
    ) as ranked;

    return next;
  end loop;
end;
$$;

create or replace function public.complete_weekly_report(
  p_tenant_id uuid,
  p_week_start date,
  p_success boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.weekly_reports
  set sent_at = case when p_success then clock_timestamp() else null end
  where tenant_id = p_tenant_id
    and week_start = p_week_start;

  return found;
end;
$$;

revoke all on function public.claim_weekly_reports(timestamptz) from public;
revoke all on function public.claim_weekly_reports(timestamptz) from anon;
revoke all on function public.claim_weekly_reports(timestamptz)
  from authenticated;
revoke all on function public.complete_weekly_report(uuid, date, boolean)
  from public;
revoke all on function public.complete_weekly_report(uuid, date, boolean)
  from anon;
revoke all on function public.complete_weekly_report(uuid, date, boolean)
  from authenticated;

grant execute on function public.claim_weekly_reports(timestamptz)
  to service_role;
grant execute on function public.complete_weekly_report(uuid, date, boolean)
  to service_role;
