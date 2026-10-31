begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email)
values
  ('9a000000-0000-4000-8000-000000000001', 'tags-a@example.test'),
  ('9a000000-0000-4000-8000-000000000002', 'tags-b@example.test');

select set_config('test.tenant_a',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '9a000000-0000-4000-8000-000000000001'), true);

insert into public.monitors (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, alert_at
)
values (
  '9b000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_a')::uuid,
  repeat('1', 64), 'tagg01', 60, 10, now() + interval '70 seconds'
);

select is(
  (select tags from public.monitors
   where id = '9b000000-0000-4000-8000-000000000001'),
  '{}'::text[],
  'a monitor has no tag by default'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',
  '9a000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$update public.monitors set tags = array['prod', 'db-backup']
    where id = '9b000000-0000-4000-8000-000000000001'$$,
  'a member can tag their monitor'
);

select throws_ok(
  $$update public.monitors set tags = array['Prod']
    where id = '9b000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'uppercase tags are rejected'
);

select throws_ok(
  $$update public.monitors set tags = array['a', 'a']
    where id = '9b000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'duplicate tags are rejected'
);

select throws_ok(
  $$update public.monitors set tags = array['bad tag!']
    where id = '9b000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'invalid characters are rejected'
);

select throws_ok(
  $$update public.monitors
    set tags = array['a','b','c','d','e','f','g','h','i','j','k']
    where id = '9b000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'more than ten tags are rejected'
);

select is(
  (select count(*)::integer from public.monitors
   where tags @> array['prod']),
  1,
  'tagged monitors can be filtered'
);

select * from finish();

rollback;
