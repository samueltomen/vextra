-- Forward-only migration. Production rollback requires a new migration.

create unique index monitors_tenant_id_id_uidx
  on public.monitors (tenant_id, id);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  monitor_id uuid not null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  reason text not null default 'heartbeat_missed'
    check (reason = 'heartbeat_missed'),
  resolution_reason text
    check (
      resolution_reason is null
      or resolution_reason in ('heartbeat_received', 'manual')
    ),
  foreign key (tenant_id, monitor_id)
    references public.monitors (tenant_id, id)
    on delete cascade,
  check (resolved_at is null or resolved_at >= opened_at)
);

create unique index incidents_one_open_per_monitor_idx
  on public.incidents (monitor_id)
  where resolved_at is null;

create index incidents_tenant_opened_idx
  on public.incidents (tenant_id, opened_at desc);

alter table public.incidents enable row level security;

create policy incidents_select_member
on public.incidents
for select
to authenticated
using (public.is_tenant_member(tenant_id));

revoke all on table public.incidents from anon;
grant select on table public.incidents to authenticated;

create or replace function public.record_heartbeat(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  received_at timestamptz := clock_timestamp();
  target_monitor record;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  select
    id,
    interval_seconds,
    grace_seconds
  into target_monitor
  from public.monitors
  where heartbeat_token_hash = p_token_hash
    and enabled
    and status <> 'paused'
  for update;

  if not found then
    return false;
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
    incident_opened_at = null
  where id = target_monitor.id;

  update public.incidents
  set
    resolved_at = received_at,
    resolution_reason = 'heartbeat_received'
  where monitor_id = target_monitor.id
    and resolved_at is null;

  return true;
end;
$$;

revoke all on function public.record_heartbeat(text) from public;
revoke all on function public.record_heartbeat(text) from authenticated;
grant execute on function public.record_heartbeat(text) to anon;

create or replace function public.open_due_monitor_incidents(
  p_batch_size integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  checked_at timestamptz := clock_timestamp();
  opened_count integer := 0;
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
    order by alert_at
    limit p_batch_size
    for update skip locked
  loop
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
    on conflict (monitor_id) where resolved_at is null do nothing;

    opened_count := opened_count + 1;
  end loop;

  return opened_count;
end;
$$;

revoke all on function public.open_due_monitor_incidents(integer) from public;
revoke all on function public.open_due_monitor_incidents(integer) from anon;
revoke all on function public.open_due_monitor_incidents(integer)
  from authenticated;
grant execute on function public.open_due_monitor_incidents(integer)
  to service_role;

comment on table public.incidents is
  'Incident lifecycle only. No script output, logs, IP or request payload.';
comment on function public.record_heartbeat(text) is
  'Atomically records an authenticated heartbeat hash and resolves incidents.';
comment on function public.open_due_monitor_incidents(integer) is
  'Atomically opens at most one incident per overdue monitor.';
