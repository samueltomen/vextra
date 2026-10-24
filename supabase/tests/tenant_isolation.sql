begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'alice@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'bob@example.test')
on conflict (id) do nothing;

insert into public.tenants (id)
values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'owner'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'owner'
  )
on conflict (tenant_id, user_id) do nothing;

insert into public.monitors (
  id,
  tenant_id,
  heartbeat_token_hash,
  heartbeat_token_prefix,
  interval_seconds,
  grace_seconds,
  alert_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    'alice-to',
    300,
    30,
    now() + interval '5 minutes'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    repeat('b', 64),
    'bob-toke',
    300,
    30,
    now() + interval '5 minutes'
  )
on conflict (id) do nothing;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

select is(
  (select count(*) from public.tenants),
  1::bigint,
  'a user sees only the tenant they belong to'
);

select is(
  (select count(*) from public.tenant_memberships),
  1::bigint,
  'a user sees only their own membership'
);

select is(
  (select count(*) from public.monitors),
  1::bigint,
  'a user sees only monitors from their tenant'
);

select is(
  (
    select count(*)
    from public.monitors
    where tenant_id = '10000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'a user cannot read another tenant monitor by id'
);

select ok(
  public.is_tenant_member('10000000-0000-4000-8000-000000000001'),
  'membership function authorizes the current tenant'
);

select isnt(
  public.is_tenant_member('10000000-0000-4000-8000-000000000002'),
  true,
  'membership function rejects another tenant'
);

with changed as (
  update public.monitors
  set enabled = false
  where tenant_id = '10000000-0000-4000-8000-000000000002'
  returning id
)
select is(
  (select count(*) from changed),
  0::bigint,
  'a user cannot update another tenant monitor'
);

select throws_ok(
  $$
    insert into public.monitors (
      tenant_id,
      heartbeat_token_hash,
      heartbeat_token_prefix,
      interval_seconds,
      grace_seconds,
      alert_at
    )
    values (
      '10000000-0000-4000-8000-000000000002',
      repeat('c', 64),
      'attack-t',
      300,
      30,
      now() + interval '5 minutes'
    )
  $$,
  '42501',
  null,
  'a user cannot insert a monitor into another tenant'
);

select * from finish();

rollback;
