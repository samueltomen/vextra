-- Forward-only migration. Production rollback requires a new migration.

alter table public.monitors
  add column cron_expression text
    check (
      cron_expression is null
      or char_length(cron_expression) between 1 and 120
    ),
  add column cron_timezone text
    check (
      cron_timezone is null
      or char_length(cron_timezone) between 1 and 64
    ),
  add column cron_deadline_stale boolean not null default false,
  add constraint monitors_cron_pair
    check ((cron_expression is null) = (cron_timezone is null));

comment on column public.monitors.cron_expression is
  'Optional five-field cron schedule. The interval then holds the longest gap.';
comment on column public.monitors.cron_deadline_stale is
  'True when the exact deadline of a cron monitor must be recomputed by the API.';

-- A cron deadline cannot be computed in SQL. Until the API refines it, the
-- deadline is last heartbeat + longest gap + grace, which is never too early.
create or replace function public.flag_cron_deadline_stale()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cron_expression is not null and (
    new.last_heartbeat_at is distinct from old.last_heartbeat_at
    or new.cron_expression is distinct from old.cron_expression
    or new.cron_timezone is distinct from old.cron_timezone
    or (old.status = 'paused' and new.status <> 'paused')
  ) then
    new.cron_deadline_stale := true;
  end if;

  return new;
end;
$$;

create trigger monitors_flag_cron_deadline_stale
before update on public.monitors
for each row
execute function public.flag_cron_deadline_stale();

create or replace function public.update_monitor_schedule_v2(
  p_monitor_id uuid,
  p_interval_seconds integer,
  p_grace_seconds integer,
  p_cron_expression text default null,
  p_cron_timezone text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_monitor record;
begin
  if p_interval_seconds not between 60 and 31536000
    or p_grace_seconds not between 0 and 604800
    or (p_cron_expression is null) <> (p_cron_timezone is null)
  then
    raise exception 'invalid monitor schedule' using errcode = '22023';
  end if;

  select tenant_id
  into target_monitor
  from public.monitors
  where id = p_monitor_id
  for update;

  if not found or not public.is_tenant_member(target_monitor.tenant_id) then
    return false;
  end if;

  -- Same rules as update_monitor_schedule: a paused monitor keeps its deadline,
  -- a late monitor keeps the deadline that opened its incident. For a cron
  -- monitor the deadline is provisional and refined by the API right after.
  update public.monitors
  set
    interval_seconds = p_interval_seconds,
    grace_seconds = p_grace_seconds,
    cron_expression = p_cron_expression,
    cron_timezone = p_cron_timezone,
    cron_deadline_stale = p_cron_expression is not null,
    alert_at = case
      when status in ('paused', 'late') then alert_at
      else clock_timestamp()
        + make_interval(secs => p_interval_seconds + p_grace_seconds)
    end
  where id = p_monitor_id;

  return true;
end;
$$;

create or replace function public.claim_stale_cron_monitors(
  p_batch_size integer
)
returns table (
  monitor_id uuid,
  cron_expression text,
  cron_timezone text,
  grace_seconds integer,
  last_heartbeat_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_batch_size < 1 or p_batch_size > 1000 then
    raise exception 'batch size must be between 1 and 1000'
      using errcode = '22023';
  end if;

  -- Nothing is marked here: set_cron_deadline clears the flag, so a crash
  -- between the two simply makes the next pass retry.
  return query
  select
    monitor.id,
    monitor.cron_expression,
    monitor.cron_timezone,
    monitor.grace_seconds,
    monitor.last_heartbeat_at
  from public.monitors as monitor
  where monitor.cron_expression is not null
    and monitor.cron_deadline_stale
    and monitor.enabled
    and monitor.status in ('pending', 'healthy')
  order by monitor.updated_at
  limit p_batch_size
  for update of monitor skip locked;
end;
$$;

create or replace function public.set_cron_deadline(
  p_monitor_id uuid,
  p_alert_at timestamptz,
  p_expected_heartbeat_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_alert_at < clock_timestamp() - interval '1 minute'
    or p_alert_at > clock_timestamp() + interval '2 years'
  then
    raise exception 'unreasonable deadline' using errcode = '22023';
  end if;

  -- Applied only if no heartbeat arrived since the deadline was computed.
  update public.monitors
  set
    alert_at = p_alert_at,
    cron_deadline_stale = false
  where id = p_monitor_id
    and cron_expression is not null
    and status in ('pending', 'healthy')
    and last_heartbeat_at is not distinct from p_expected_heartbeat_at;

  return found;
end;
$$;

revoke all on function public.update_monitor_schedule_v2(
  uuid, integer, integer, text, text
) from public;
revoke all on function public.update_monitor_schedule_v2(
  uuid, integer, integer, text, text
) from anon;
grant execute on function public.update_monitor_schedule_v2(
  uuid, integer, integer, text, text
) to authenticated;

revoke all on function public.claim_stale_cron_monitors(integer) from public;
revoke all on function public.claim_stale_cron_monitors(integer) from anon;
revoke all on function public.claim_stale_cron_monitors(integer)
  from authenticated;
revoke all on function public.set_cron_deadline(uuid, timestamptz, timestamptz)
  from public;
revoke all on function public.set_cron_deadline(uuid, timestamptz, timestamptz)
  from anon;
revoke all on function public.set_cron_deadline(uuid, timestamptz, timestamptz)
  from authenticated;

grant execute on function public.claim_stale_cron_monitors(integer)
  to service_role;
grant execute on function public.set_cron_deadline(uuid, timestamptz, timestamptz)
  to service_role;
