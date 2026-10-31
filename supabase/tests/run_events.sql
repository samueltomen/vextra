begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email)
values
  ('81000000-0000-4000-8000-000000000001', 'runs-a@example.test'),
  ('81000000-0000-4000-8000-000000000002', 'runs-b@example.test');

select set_config(
  'test.tenant_a',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '81000000-0000-4000-8000-000000000001'),
  true
);

insert into public.monitors (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, alert_at
)
values
  ('82000000-0000-4000-8000-000000000001',
   current_setting('test.tenant_a')::uuid,
   repeat('5', 64), 'runs001', 60, 10, now() + interval '70 seconds'),
  ('82000000-0000-4000-8000-000000000002',
   current_setting('test.tenant_a')::uuid,
   repeat('6', 64), 'runs002', 60, 10, now() + interval '70 seconds');

update public.monitors
set status = 'paused', paused_at = now()
where id = '82000000-0000-4000-8000-000000000002';

select is(public.record_run_event(repeat('5', 64), 'start'), true,
  'a start ping is accepted');

select ok(
  (select running_since is not null from public.monitors
   where id = '82000000-0000-4000-8000-000000000001'),
  'a start ping marks the monitor as running'
);

select is(public.record_run_event(repeat('5', 64), 'start'), true,
  'a second start while running is accepted');

select is(
  (select count(*)::integer from public.monitor_runs
   where monitor_id = '82000000-0000-4000-8000-000000000001'
     and kind = 'start' and overlapped),
  1,
  'the second start is flagged as an overlap'
);

select is(public.record_run_event(repeat('5', 64), 'warn'), true,
  'a warn ping is accepted');

select is(
  (select status from public.monitors
   where id = '82000000-0000-4000-8000-000000000001'),
  'pending',
  'a warn ping does not change the monitor status'
);

select is(public.record_heartbeat(repeat('5', 64)), true,
  'a success after a start is accepted');

select ok(
  (select running_since is null from public.monitors
   where id = '82000000-0000-4000-8000-000000000001')
  and (select duration_ms is not null from public.monitor_runs
       where monitor_id = '82000000-0000-4000-8000-000000000001'
         and kind = 'success'),
  'the success clears the running state and records the duration'
);

select is(public.record_run_event(repeat('5', 64), 'fail'), true,
  'a fail ping is accepted');

select is(
  (select count(*)::integer from public.incidents
   where monitor_id = '82000000-0000-4000-8000-000000000001'
     and reason = 'run_failed' and resolved_at is null),
  1,
  'a fail ping opens a run_failed incident immediately'
);

select is(
  (select count(*)::integer from public.notification_outbox
   where monitor_id = '82000000-0000-4000-8000-000000000001'
     and kind = 'run_failed'),
  1,
  'the failure enqueues one alert'
);

select public.record_run_event(repeat('5', 64), 'fail');

select is(
  (select count(*)::integer from public.incidents
   where monitor_id = '82000000-0000-4000-8000-000000000001'
     and resolved_at is null),
  1,
  'a second failure does not open a second incident'
);

select is(public.record_run_event(repeat('6', 64), 'start')
  or public.record_run_event(repeat('5', 64), 'explode'), false,
  'a paused monitor and an unknown kind are rejected');

set local role authenticated;
select set_config('request.jwt.claim.sub',
  '81000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.monitor_runs),
  0,
  'another tenant cannot read the run history'
);

select * from finish();

rollback;
