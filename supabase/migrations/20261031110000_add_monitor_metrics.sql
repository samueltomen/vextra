-- Forward-only migration. Production rollback requires a new migration.

alter table public.monitors
  add column total_pings bigint not null default 0 check (total_pings >= 0);

create table public.monitor_daily_stats (
  monitor_id uuid not null,
  tenant_id uuid not null,
  day date not null,
  pings integer not null default 0 check (pings >= 0),
  gap_count integer not null default 0 check (gap_count >= 0),
  gap_sum_seconds bigint not null default 0 check (gap_sum_seconds >= 0),
  gap_max_seconds integer not null default 0 check (gap_max_seconds >= 0),
  primary key (monitor_id, day),
  foreign key (tenant_id, monitor_id)
    references public.monitors (tenant_id, id)
    on delete cascade
);

create index monitor_daily_stats_tenant_day_idx
  on public.monitor_daily_stats (tenant_id, day desc);

alter table public.monitor_daily_stats enable row level security;

create policy monitor_daily_stats_select_member
on public.monitor_daily_stats
for select
to authenticated
using (public.is_tenant_member(tenant_id));

revoke all on table public.monitor_daily_stats from anon;
grant select on table public.monitor_daily_stats to authenticated;

create or replace function public.record_heartbeat(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  received_at timestamptz := clock_timestamp();
  gap_seconds integer;
  target_monitor record;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  select
    id,
    tenant_id,
    interval_seconds,
    grace_seconds,
    last_heartbeat_at
  into target_monitor
  from public.monitors
  where heartbeat_token_hash = p_token_hash
    and enabled
    and status <> 'paused'
  for update;

  if not found then
    return false;
  end if;

  if target_monitor.last_heartbeat_at is not null then
    gap_seconds := least(
      greatest(
        floor(
          extract(epoch from (received_at - target_monitor.last_heartbeat_at))
        )::integer,
        0
      ),
      31536000
    );
  end if;

  update public.monitors
  set
    status = 'healthy',
    last_heartbeat_at = received_at,
    alert_at = received_at
      + make_interval(
        secs => target_monitor.interval_seconds
          + target_monitor.grace_seconds
      ),
    incident_opened_at = null,
    total_pings = total_pings + 1
  where id = target_monitor.id;

  insert into public.monitor_daily_stats as stats (
    monitor_id,
    tenant_id,
    day,
    pings,
    gap_count,
    gap_sum_seconds,
    gap_max_seconds
  )
  values (
    target_monitor.id,
    target_monitor.tenant_id,
    (received_at at time zone 'utc')::date,
    1,
    case when gap_seconds is null then 0 else 1 end,
    coalesce(gap_seconds, 0),
    coalesce(gap_seconds, 0)
  )
  on conflict (monitor_id, day) do update
  set
    pings = stats.pings + 1,
    gap_count = stats.gap_count + excluded.gap_count,
    gap_sum_seconds = stats.gap_sum_seconds + excluded.gap_sum_seconds,
    gap_max_seconds = greatest(stats.gap_max_seconds, excluded.gap_max_seconds);

  delete from public.monitor_daily_stats
  where monitor_id = target_monitor.id
    and day < (received_at at time zone 'utc')::date - 90;

  with resolved as (
    update public.incidents
    set
      resolved_at = received_at,
      resolution_reason = 'heartbeat_received'
    where monitor_id = target_monitor.id
      and resolved_at is null
    returning id, tenant_id, monitor_id
  )
  insert into public.notification_outbox (
    tenant_id,
    monitor_id,
    incident_id,
    kind,
    idempotency_key
  )
  select
    tenant_id,
    monitor_id,
    id,
    'incident_resolved',
    'incident_resolved:' || id::text
  from resolved
  on conflict (idempotency_key) do nothing;

  return true;
end;
$$;

comment on table public.monitor_daily_stats is
  'Per-day heartbeat counters and gaps. Counts only: no IP, payload or log.';
comment on column public.monitors.total_pings is
  'Number of accepted heartbeats since creation.';
