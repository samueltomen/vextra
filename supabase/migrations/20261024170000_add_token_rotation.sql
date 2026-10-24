-- Forward-only migration. Production rollback requires a new migration.

create or replace function public.rotate_monitor_token(
  p_monitor_id uuid,
  p_token_hash text,
  p_token_prefix text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_tenant_id uuid;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$'
    or char_length(p_token_prefix) < 6
    or char_length(p_token_prefix) > 12
  then
    return false;
  end if;

  select tenant_id
  into target_tenant_id
  from public.monitors
  where id = p_monitor_id;

  if not found or not public.is_tenant_member(target_tenant_id) then
    return false;
  end if;

  update public.monitors
  set
    heartbeat_token_hash = p_token_hash,
    heartbeat_token_prefix = p_token_prefix
  where id = p_monitor_id;

  return true;
end;
$$;

revoke all on function public.rotate_monitor_token(uuid, text, text)
  from public;
revoke all on function public.rotate_monitor_token(uuid, text, text)
  from anon;
grant execute on function public.rotate_monitor_token(uuid, text, text)
  to authenticated;

comment on function public.rotate_monitor_token(uuid, text, text) is
  'Replaces a tenant-owned monitor token hash and prefix atomically.';
