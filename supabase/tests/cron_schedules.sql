begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email)
values
  ('91000000-0000-4000-8000-000000000001', 'cron-a@example.test'),
  ('91000000-0000-4000-8000-000000000002', 'cron-b@example.test');

select set_config(
  'test.tenant_a',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '91000000-0000-4000-8000-000000000001'),
  true
);

insert into public.monitors (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, alert_at
)
values
  ('92000000-0000-4000-8000-000000000001',
   current_setting('test.tenant_a')::uuid,
   repeat('9', 64), 'cron001', 60, 10, now() + interval '70 seconds'),
  ('92000000-0000-4000-8000-000000000002',
   current_setting('test.tenant_a')::uuid,
   repeat('b', 64), 'cron002', 60, 10, now() + interval '70 seconds');

set local role authenticated;
select set_config('request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001', true);

select is(
  public.update_monitor_schedule_v2(
    '92000000-0000-4000-8000-000000000001',
    90000, 300, '0 3 * * *', 'Europe/Paris'),
  true,
  'a member can switch a monitor to a cron schedule'
);

select is(
  (select cron_expression || '|' || cron_timezone || '|' || interval_seconds
          || '|' || cron_deadline_stale
   from public.monitors
   where id = '92000000-0000-4000-8000-000000000001'),
  '0 3 * * *|Europe/Paris|90000|true',
  'the cron schedule, the longest gap and the stale flag are stored'
);

select throws_ok(
  $$select public.update_monitor_schedule_v2(
      '92000000-0000-4000-8000-000000000001', 90000, 300, '0 3 * * *', null)$$,
  '22023',
  null,
  'a cron expression without a time zone is rejected'
);

select is(
  public.update_monitor_schedule_v2(
    '92000000-0000-4000-8000-000000000002', 600, 60),
  true,
  'a plain interval schedule can still be set'
);

select is(
  (select (cron_expression is null and not cron_deadline_stale)::text
   from public.monitors
   where id = '92000000-0000-4000-8000-000000000002'),
  'true',
  'an interval schedule has no cron data'
);

select set_config('request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000002', true);

select is(
  public.update_monitor_schedule_v2(
    '92000000-0000-4000-8000-000000000001',
    600, 60, '* * * * *', 'UTC'),
  false,
  'another tenant cannot change the schedule'
);

reset role;

select is(
  (select count(*)::integer
   from public.claim_stale_cron_monitors(10)
   where monitor_id = '92000000-0000-4000-8000-000000000001'
     and cron_expression = '0 3 * * *'
     and cron_timezone = 'Europe/Paris'),
  1,
  'the service claims a cron monitor whose deadline is stale'
);

select is(
  (select count(*)::integer
   from public.claim_stale_cron_monitors(10)
   where monitor_id = '92000000-0000-4000-8000-000000000002'),
  0,
  'a monitor without cron is never claimed'
);

select is(
  public.set_cron_deadline(
    '92000000-0000-4000-8000-000000000001',
    now() + interval '5 hours',
    null),
  true,
  'the exact deadline is applied when no heartbeat happened meanwhile'
);

select is(
  (select cron_deadline_stale::text from public.monitors
   where id = '92000000-0000-4000-8000-000000000001'),
  'false',
  'applying the deadline clears the stale flag'
);

select public.record_heartbeat(repeat('9', 64));

select is(
  (select cron_deadline_stale::text from public.monitors
   where id = '92000000-0000-4000-8000-000000000001'),
  'true',
  'a heartbeat marks the deadline of a cron monitor as stale again'
);

select is(
  public.set_cron_deadline(
    '92000000-0000-4000-8000-000000000001',
    now() + interval '9 hours',
    now() - interval '1 hour'),
  false,
  'a deadline computed before a newer heartbeat is not applied'
);

update public.monitors
set status = 'late', cron_deadline_stale = true
where id = '92000000-0000-4000-8000-000000000001';

select is(
  (select count(*)::integer
   from public.claim_stale_cron_monitors(10)
   where monitor_id = '92000000-0000-4000-8000-000000000001'),
  0,
  'a late monitor keeps the deadline that opened its incident'
);

select throws_ok(
  $$select public.set_cron_deadline(
      '92000000-0000-4000-8000-000000000001',
      now() + interval '10 years', null)$$,
  '22023',
  null,
  'an unreasonable deadline is refused'
);

select * from finish();

rollback;
