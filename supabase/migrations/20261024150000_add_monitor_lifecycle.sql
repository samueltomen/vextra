-- Forward-only migration. Production rollback requires a new migration.

create or replace function public.pause_monitor(p_monitor_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_tenant_id uuid;
begin
  select tenant_id
  into target_tenant_id
  from public.monitors
  where id = p_monitor_id;

  if not found or not public.is_tenant_member(target_tenant_id) then
    return false;
  end if;

  update public.monitors
  set
    status = 'paused',
    paused_at = clock_timestamp(),
    incident_opened_at = null
  where id = p_monitor_id;

  update public.incidents
  set
    resolved_at = clock_timestamp(),
    resolution_reason = 'manual'
  where monitor_id = p_monitor_id
    and resolved_at is null;

  return true;
end;
$$;

create or replace function public.resume_monitor(p_monitor_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_monitor record;
begin
  select
    tenant_id,
    interval_seconds,
    grace_seconds,
    last_heartbeat_at
  into target_monitor
  from public.monitors
  where id = p_monitor_id;

  if not found or not public.is_tenant_member(target_monitor.tenant_id) then
    return false;
  end if;

  update public.monitors
  set
    status = case
      when target_monitor.last_heartbeat_at is null then 'pending'
      else 'healthy'
    end,
    paused_at = null,
    incident_opened_at = null,
    alert_at = clock_timestamp()
      + make_interval(
        secs => target_monitor.interval_seconds
          + target_monitor.grace_seconds
      )
  where id = p_monitor_id;

  return true;
end;
$$;

create or replace function public.delete_monitor(p_monitor_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_tenant_id uuid;
begin
  select tenant_id
  into target_tenant_id
  from public.monitors
  where id = p_monitor_id;

  if not found or not public.is_tenant_member(target_tenant_id) then
    return false;
  end if;

  delete from public.monitors
  where id = p_monitor_id;

  return true;
end;
$$;

revoke all on function public.pause_monitor(uuid) from public;
revoke all on function public.pause_monitor(uuid) from anon;
revoke all on function public.resume_monitor(uuid) from public;
revoke all on function public.resume_monitor(uuid) from anon;
revoke all on function public.delete_monitor(uuid) from public;
revoke all on function public.delete_monitor(uuid) from anon;

grant execute on function public.pause_monitor(uuid) to authenticated;
grant execute on function public.resume_monitor(uuid) to authenticated;
grant execute on function public.delete_monitor(uuid) to authenticated;

comment on function public.pause_monitor(uuid) is
  'Pauses a tenant-owned monitor and closes its open incident.';
comment on function public.resume_monitor(uuid) is
  'Resumes a paused monitor with a fresh deadline.';
comment on function public.delete_monitor(uuid) is
  'Deletes a tenant-owned monitor and cascades its incident history.';
