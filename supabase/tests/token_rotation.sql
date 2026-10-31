begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email)
values (
  '90000000-0000-4000-8000-000000000001',
  'rotation@example.test'
);

select set_config(
  'test.tenant_id',
  (
    select tenant_id::text
    from public.tenant_memberships
    where user_id = '90000000-0000-4000-8000-000000000001'
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
values (
  '91000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_id')::uuid,
  repeat('a', 64),
  'oldpref',
  60,
  10,
  now() + interval '1 minute'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-4000-8000-000000000001',
  true
);

select is(
  public.rotate_monitor_token(
    '91000000-0000-4000-8000-000000000001',
    repeat('b', 64),
    'newpref'
  ),
  true,
  'a tenant member can rotate their monitor token'
);

select throws_ok(
  $$select heartbeat_token_hash from public.monitors$$,
  '42501',
  null,
  'clients can never read the token hash'
);

select is(
  (
    select heartbeat_token_prefix
    from public.monitors
    where id = '91000000-0000-4000-8000-000000000001'
  ),
  'newpref',
  'the visible prefix is updated'
);

reset role;

select is(
  (
    select heartbeat_token_hash
    from public.monitors
    where id = '91000000-0000-4000-8000-000000000001'
  ),
  repeat('b', 64),
  'the new hash replaces the old hash'
);

select is(
  public.record_heartbeat(repeat('a', 64)),
  false,
  'the old token hash no longer records heartbeats'
);

select is(
  public.record_heartbeat(repeat('b', 64)),
  true,
  'the new token hash records heartbeats'
);

select * from finish();

rollback;
