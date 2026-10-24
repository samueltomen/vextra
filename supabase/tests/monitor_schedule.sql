begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email)
values
  ('73000000-0000-4000-8000-000000000001', 'schedule-a@example.test'),
  ('73000000-0000-4000-8000-000000000002', 'schedule-b@example.test');

select set_config(
  'test.tenant_a',
  (
    select tenant_id::text
    from public.tenant_memberships
    where user_id = '73000000-0000-4000-8000-000000000001'
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
  alert_at,
  status
)
values
  (
    '74000000-0000-4000-8000-000000000001',
    current_setting('test.tenant_a')::uuid,
    repeat('d', 64),
    'sched01',
    60,
    10,
    now() + interval '70 seconds',
    'pending'
  ),
  (
    '74000000-0000-4000-8000-000000000002',
    current_setting('test.tenant_a')::uuid,
    repeat('e', 64),
    'sched02',
    60,
    10,
    now() - interval '1 minute',
    'late'
  ),
  (
    '74000000-0000-4000-8000-000000000003',
    current_setting('test.tenant_a')::uuid,
    repeat('f', 64),
    'sched03',
    60,
    10,
    now() + interval '1 day',
    'paused'
  );

select set_config(
  'test.late_alert_at',
  (
    select alert_at::text
    from public.monitors
    where id = '74000000-0000-4000-8000-000000000002'
  ),
  true
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '73000000-0000-4000-8000-000000000001',
  true
);

select is(
  public.update_monitor_schedule(
    '74000000-0000-4000-8000-000000000001',
    3600,
    300
  ),
  true,
  'a tenant member can change the schedule of their monitor'
);

select is(
  (
    select interval_seconds * 1000 + grace_seconds
    from public.monitors
    where id = '74000000-0000-4000-8000-000000000001'
  ),
  3600300,
  'the interval and the grace are persisted'
);

select ok(
  (
    select alert_at > now() + interval '3800 seconds'
    from public.monitors
    where id = '74000000-0000-4000-8000-000000000001'
  ),
  'a pending monitor gets a fresh deadline from the new schedule'
);

select is(
  public.update_monitor_schedule(
    '74000000-0000-4000-8000-000000000002',
    120,
    20
  ),
  true,
  'a late monitor can be edited'
);

select is(
  (
    select alert_at::text
    from public.monitors
    where id = '74000000-0000-4000-8000-000000000002'
  ),
  current_setting('test.late_alert_at'),
  'a late monitor keeps the deadline that opened its incident'
);

select ok(
  public.update_monitor_schedule(
    '74000000-0000-4000-8000-000000000003',
    120,
    20
  )
  and (
    select alert_at > now() + interval '12 hours'
    from public.monitors
    where id = '74000000-0000-4000-8000-000000000003'
  ),
  'a paused monitor is edited but keeps its deadline until it resumes'
);

select set_config(
  'request.jwt.claim.sub',
  '73000000-0000-4000-8000-000000000002',
  true
);

select is(
  public.update_monitor_schedule(
    '74000000-0000-4000-8000-000000000001',
    120,
    20
  ),
  false,
  'a member of another tenant cannot edit the monitor'
);

select throws_ok(
  $$select public.update_monitor_schedule(
    '74000000-0000-4000-8000-000000000001',
    30,
    0
  )$$,
  '22023',
  'invalid monitor schedule',
  'an interval below one minute is rejected'
);

select * from finish();

rollback;
