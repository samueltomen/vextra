-- Forward-only migration. Production rollback requires a new migration.

create or replace function public.provision_personal_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_tenant_id uuid;
begin
  insert into public.tenants default values
  returning id into created_tenant_id;

  insert into public.tenant_memberships (tenant_id, user_id, role)
  values (created_tenant_id, new.id, 'owner');

  return new;
end;
$$;

revoke all on function public.provision_personal_tenant() from public;
revoke all on function public.provision_personal_tenant() from anon;
revoke all on function public.provision_personal_tenant() from authenticated;

create trigger auth_user_creates_personal_tenant
after insert on auth.users
for each row
execute function public.provision_personal_tenant();

comment on function public.provision_personal_tenant() is
  'Creates the tenant boundary and owner membership after an auth signup.';
