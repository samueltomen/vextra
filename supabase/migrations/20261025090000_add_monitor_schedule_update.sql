-- Forward-only migration. Production rollback requires a new migration.

create or replace function public.update_monitor_schedule(
  p_monitor_id uuid,
  p_interval_seconds integer,
  p_grace_seconds integer
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

  -- A paused monitor keeps its deadline until it resumes, and a late monitor
  -- keeps the deadline that opened its incident. Other monitors get a fresh
  -- deadline computed from the new schedule.
  update public.monitors
  set
    interval_seconds = p_interval_seconds,
    grace_seconds = p_grace_seconds,
    alert_at = case
      when status in ('paused', 'late') then alert_at
      else clock_timestamp()
        + make_interval(secs => p_interval_seconds + p_grace_seconds)
    end
  where id = p_monitor_id;

  return true;
end;
$$;

revoke all on function public.update_monitor_schedule(uuid, integer, integer)
  from public;
revoke all on function public.update_monitor_schedule(uuid, integer, integer)
  from anon;
grant execute on function public.update_monitor_schedule(uuid, integer, integer)
  to authenticated;

comment on function public.update_monitor_schedule(uuid, integer, integer) is
  'Changes the interval and grace of a tenant-owned monitor and refreshes its deadline.';
