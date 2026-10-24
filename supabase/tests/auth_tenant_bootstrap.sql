begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email)
values
  ('30000000-0000-4000-8000-000000000001', 'signup-a@example.test'),
  ('30000000-0000-4000-8000-000000000002', 'signup-b@example.test');

select is(
  (
    select count(*)
    from public.tenant_memberships
    where user_id = '30000000-0000-4000-8000-000000000001'
      and role = 'owner'
  ),
  1::bigint,
  'signup creates one owner membership for the new user'
);

select is(
  (
    select count(*)
    from public.tenants
    where id = (
      select tenant_id
      from public.tenant_memberships
      where user_id = '30000000-0000-4000-8000-000000000001'
    )
  ),
  1::bigint,
  'signup creates the tenant referenced by the owner membership'
);

select isnt(
  (
    select tenant_id
    from public.tenant_memberships
    where user_id = '30000000-0000-4000-8000-000000000001'
  ),
  (
    select tenant_id
    from public.tenant_memberships
    where user_id = '30000000-0000-4000-8000-000000000002'
  ),
  'each signup receives a distinct tenant'
);

select is(
  (select count(*) from public.tenants),
  2::bigint,
  'two signups create exactly two tenants'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'auth_user_creates_personal_tenant'
      and not tgisinternal
  ),
  'the auth user trigger is installed'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.provision_personal_tenant()',
    'execute'
  ),
  false,
  'authenticated users cannot execute the tenant provisioning function'
);

select * from finish();

rollback;
