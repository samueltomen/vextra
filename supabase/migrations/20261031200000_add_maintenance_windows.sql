-- Forward-only migration. Production rollback requires a new migration.
-- Maintenance windows: no incident (and therefore no alert) is opened for a
-- monitor while a window covers it, nor during its grace period afterwards.

create table public.maintenance_windows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  monitor_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at <= starts_at + interval '30 days'),
  foreign key (tenant_id, monitor_id)
    references public.monitors (tenant_id, id)
    on delete cascade
);

create index maintenance_windows_tenant_idx
  on public.maintenance_windows (tenant_id, ends_at);

create or replace function public.enforce_maintenance_window_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from public.maintenance_windows
    where tenant_id = new.tenant_id and ends_at > now()
  ) >= 100 then
    raise exception 'maintenance window limit reached'
      using errcode = '54000';
  end if;

  return new;
end;
$$;

create trigger maintenance_windows_limit
before insert on public.maintenance_windows
for each row
execute function public.enforce_maintenance_window_limit();

alter table public.maintenance_windows enable row level security;

create policy maintenance_windows_select_member
on public.maintenance_windows for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy maintenance_windows_insert_member
on public.maintenance_windows for insert to authenticated
with check (public.is_tenant_member(tenant_id));

create policy maintenance_windows_delete_member
on public.maintenance_windows for delete to authenticated
using (public.is_tenant_member(tenant_id));

revoke all on table public.maintenance_windows from anon;
grant select, insert, delete on table public.maintenance_windows to authenticated;

create or replace function public.is_in_maintenance(
  p_tenant_id uuid,
  p_monitor_id uuid,
  p_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.maintenance_windows w
    join public.monitors m
      on m.tenant_id = w.tenant_id and m.id = p_monitor_id
    where w.tenant_id = p_tenant_id
      and (w.monitor_id is null or w.monitor_id = p_monitor_id)
      and w.starts_at <= p_at
      and p_at < w.ends_at + make_interval(secs => m.grace_seconds)
  );
$$;

revoke all on function public.is_in_maintenance(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.is_in_maintenance(uuid, uuid, timestamptz)
  to service_role;

CREATE OR REPLACE FUNCTION public.record_run_event(p_token_hash text, p_kind text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  received_at timestamptz := clock_timestamp();
  opened_incident_id uuid;
  run_duration integer;
  target_monitor record;
  was_running boolean;
begin
  if p_kind not in ('start', 'fail', 'warn') then
    return false;
  end if;

  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  select
    id,
    tenant_id,
    running_since,
    incident_opened_at
  into target_monitor
  from public.monitors
  where heartbeat_token_hash = p_token_hash
    and enabled
    and status <> 'paused'
  for update;

  if not found then
    return false;
  end if;

  was_running := target_monitor.running_since is not null;

  if p_kind = 'start' then
    update public.monitors
    set running_since = received_at
    where id = target_monitor.id;

    insert into public.monitor_runs (
      tenant_id, monitor_id, kind, overlapped, created_at
    )
    values (
      target_monitor.tenant_id,
      target_monitor.id,
      'start',
      was_running,
      received_at
    );
  elsif p_kind = 'warn' then
    insert into public.monitor_runs (
      tenant_id, monitor_id, kind, created_at
    )
    values (
      target_monitor.tenant_id,
      target_monitor.id,
      'warn',
      received_at
    );
  else
    if was_running then
      run_duration := least(
        greatest(
          floor(
            extract(epoch from (received_at - target_monitor.running_since))
            * 1000
          )::integer,
          0
        ),
        2147483647
      );
    end if;

    insert into public.monitor_runs (
      tenant_id, monitor_id, kind, duration_ms, created_at
    )
    values (
      target_monitor.tenant_id,
      target_monitor.id,
      'fail',
      run_duration,
      received_at
    );

    update public.monitors
    set running_since = null
    where id = target_monitor.id;

    if target_monitor.incident_opened_at is null
      and not public.is_in_maintenance(
        target_monitor.tenant_id, target_monitor.id, received_at
      ) then
      update public.monitors
      set
        status = 'late',
        incident_opened_at = received_at
      where id = target_monitor.id;

      insert into public.incidents (tenant_id, monitor_id, opened_at, reason)
      values (
        target_monitor.tenant_id,
        target_monitor.id,
        received_at,
        'run_failed'
      )
      on conflict (monitor_id) where resolved_at is null do nothing
      returning id into opened_incident_id;

      if opened_incident_id is not null then
        insert into public.notification_outbox (
          tenant_id,
          monitor_id,
          incident_id,
          kind,
          idempotency_key
        )
        values (
          target_monitor.tenant_id,
          target_monitor.id,
          opened_incident_id,
          'run_failed',
          'run_failed:' || opened_incident_id::text
        )
        on conflict (idempotency_key) do nothing;
      end if;
    end if;

    insert into public.monitor_daily_stats as stats (
      monitor_id, tenant_id, day, fails
    )
    values (
      target_monitor.id,
      target_monitor.tenant_id,
      (received_at at time zone 'utc')::date,
      1
    )
    on conflict (monitor_id, day) do update
    set fails = stats.fails + 1;
  end if;

  delete from public.monitor_runs
  where monitor_id = target_monitor.id
    and created_at < received_at - interval '90 days';

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.open_due_monitor_incidents(p_batch_size integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  checked_at timestamptz := clock_timestamp();
  opened_count integer := 0;
  opened_incident_id uuid;
  target_monitor record;
begin
  if p_batch_size < 1 or p_batch_size > 1000 then
    raise exception 'batch size must be between 1 and 1000'
      using errcode = '22023';
  end if;

  for target_monitor in
    select id, tenant_id
    from public.monitors
    where enabled
      and status not in ('paused', 'late')
      and incident_opened_at is null
      and alert_at <= checked_at
      and not public.is_in_maintenance(tenant_id, id, checked_at)
    order by alert_at
    limit p_batch_size
    for update skip locked
  loop
    opened_incident_id := null;

    update public.monitors
    set
      status = 'late',
      incident_opened_at = checked_at
    where id = target_monitor.id;

    insert into public.incidents (tenant_id, monitor_id, opened_at, reason)
    values (
      target_monitor.tenant_id,
      target_monitor.id,
      checked_at,
      'heartbeat_missed'
    )
    on conflict (monitor_id) where resolved_at is null do nothing
    returning id into opened_incident_id;

    if opened_incident_id is not null then
      insert into public.notification_outbox (
        tenant_id,
        monitor_id,
        incident_id,
        kind,
        idempotency_key
      )
      values (
        target_monitor.tenant_id,
        target_monitor.id,
        opened_incident_id,
        'incident_opened',
        'incident_opened:' || opened_incident_id::text
      )
      on conflict (idempotency_key) do nothing;

      opened_count := opened_count + 1;
    end if;
  end loop;

  return opened_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_status_page(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_page public.status_pages%rowtype;
  v_result jsonb;
begin
  select * into v_page
  from public.status_pages
  where slug = p_slug and enabled;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'title', v_page.title,
    'description', v_page.description,
    'generatedAt', now(),
    'monitors', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', coalesce(m.name, 'Service ' || m.rn),
          'status', m.public_status,
          'uptime30d', m.uptime
        )
        order by m.rn
      )
      from (
        select
          row_number() over (order by mo.created_at, mo.id) as rn,
          mo.name,
          case
            when not mo.enabled or mo.paused_at is not null then 'paused'
            when public.is_in_maintenance(mo.tenant_id, mo.id, now()) then 'paused'
            else mo.status
          end as public_status,
          case
            when extract(epoch from (now() - greatest(mo.created_at, now() - interval '30 days'))) < 60
              then 100
            else round(
              100 * (1 - least(1, coalesce((
                select sum(extract(epoch from (
                  least(coalesce(i.resolved_at, now()), now())
                  - greatest(i.opened_at, greatest(mo.created_at, now() - interval '30 days'))
                )))
                from public.incidents i
                where i.monitor_id = mo.id
                  and coalesce(i.resolved_at, now()) > greatest(mo.created_at, now() - interval '30 days')
              ), 0) / extract(epoch from (now() - greatest(mo.created_at, now() - interval '30 days'))))),
              3
            )
          end as uptime
        from public.monitors mo
        where mo.tenant_id = v_page.tenant_id and mo.show_on_status_page
      ) m
    ), '[]'::jsonb),
    'incidents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'monitor', coalesce(x.name, 'Service ' || x.rn),
          'openedAt', x.opened_at,
          'resolvedAt', x.resolved_at
        )
        order by x.opened_at desc
      )
      from (
        select
          row_number() over (order by mo.created_at, mo.id) as rn,
          mo.name, i.opened_at, i.resolved_at
        from public.incidents i
        join public.monitors mo
          on mo.tenant_id = i.tenant_id and mo.id = i.monitor_id
        where mo.tenant_id = v_page.tenant_id
          and mo.show_on_status_page
          and i.opened_at > now() - interval '14 days'
        order by i.opened_at desc
        limit 20
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;
