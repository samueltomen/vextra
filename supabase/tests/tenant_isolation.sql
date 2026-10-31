begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'alice@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'bob@example.test')
on conflict (id) do nothing;

select set_config(
  'test.alice_tenant_id',
  (
    select tenant_id::text
    from public.tenant_memberships
    where user_id = '00000000-0000-4000-8000-000000000001'
  ),
  true
);

select set_config(
  'test.bob_tenant_id',
  (
    select tenant_id::text
    from public.tenant_memberships
    where user_id = '00000000-0000-4000-8000-000000000002'
  ),
  true
);

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
    current_setting('test.alice_tenant_id')::uuid,
    repeat('a', 64),
    'alice-to',
    300,
    30,
    now() + interval '5 minutes'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    current_setting('test.bob_tenant_id')::uuid,
    repeat('b', 64),
    'bob-toke',
    300,
    30,
    now() + interval '5 minutes'
  )
on conflict (id) do nothing;

insert into public.incidents (
  id,
  tenant_id,
  monitor_id,
  opened_at
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    current_setting('test.alice_tenant_id')::uuid,
    '20000000-0000-4000-8000-000000000001',
    now() - interval '1 minute'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    current_setting('test.bob_tenant_id')::uuid,
    '20000000-0000-4000-8000-000000000002',
    now() - interval '1 minute'
  );

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
    where tenant_id = current_setting('test.bob_tenant_id')::uuid
  ),
  0::bigint,
  'a user cannot read another tenant monitor by id'
);

select ok(
  public.is_tenant_member(current_setting('test.alice_tenant_id')::uuid),
  'membership function authorizes the current tenant'
);

select isnt(
  public.is_tenant_member(current_setting('test.bob_tenant_id')::uuid),
  true,
  'membership function rejects another tenant'
);

with changed as (
  update public.monitors
  set name = 'hijacked'
  where tenant_id = current_setting('test.bob_tenant_id')::uuid
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
      current_setting('test.bob_tenant_id')::uuid,
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

select is(
  (select count(*) from public.incidents),
  1::bigint,
  'a user sees only incidents from their tenant'
);

select is(
  (
    select count(*)
    from public.incidents
    where tenant_id = current_setting('test.bob_tenant_id')::uuid
  ),
  0::bigint,
  'a user cannot read another tenant incident by id'
);

select throws_ok(
  $$
    insert into public.incidents (
      tenant_id,
      monitor_id,
      opened_at
    )
    values (
      current_setting('test.alice_tenant_id')::uuid,
      '20000000-0000-4000-8000-000000000001',
      now()
    )
  $$,
  '42501',
  null,
  'a client cannot insert incidents directly'
);

select * from finish();

rollback;
