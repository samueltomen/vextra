-- Forward-only migration. Production rollback requires a new migration.

create or replace function public.delete_empty_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;

  delete from public.tenants
  where id = old.tenant_id
    and not exists (
      select 1
      from public.tenant_memberships
      where tenant_id = old.tenant_id
    );

  return old;
end;
$$;

revoke all on function public.delete_empty_tenant() from public;
revoke all on function public.delete_empty_tenant() from anon;
revoke all on function public.delete_empty_tenant() from authenticated;

create trigger tenant_membership_deletes_empty_tenant
after delete on public.tenant_memberships
for each row
execute function public.delete_empty_tenant();

comment on function public.delete_empty_tenant() is
  'Deletes an orphaned personal tenant and cascades all tenant-owned data.';
