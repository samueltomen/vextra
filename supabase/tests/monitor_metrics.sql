begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email)
values
  ('78000000-0000-4000-8000-000000000001', 'metrics-a@example.test'),
  ('78000000-0000-4000-8000-000000000002', 'metrics-b@example.test');

select set_config(
  'test.tenant_a',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '78000000-0000-4000-8000-000000000001'),
  true
);

insert into public.monitors (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, alert_at, last_heartbeat_at
)
values (
  '79000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_a')::uuid,
  repeat('a', 64), 'metr01', 60, 10, now() + interval '70 seconds',
  now() - interval '30 seconds'
);

insert into public.monitor_daily_stats (
  monitor_id, tenant_id, day, pings
)
values (
  '79000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_a')::uuid,
  (now() at time zone 'utc')::date - 100,
  3
);

select is(public.record_heartbeat(repeat('a', 64)), true,
  'a valid heartbeat is accepted');
select is(public.record_heartbeat(repeat('a', 64)), true,
  'a second heartbeat is accepted');

select is(
  (select total_pings from public.monitors
   where id = '79000000-0000-4000-8000-000000000001'),
  2::bigint,
  'accepted heartbeats are counted on the monitor'
);

select is(
  (select pings from public.monitor_daily_stats
   where monitor_id = '79000000-0000-4000-8000-000000000001'
     and day = (now() at time zone 'utc')::date),
  2,
  'heartbeats are aggregated in the daily bucket'
);

select ok(
  (select gap_count = 2 and gap_max_seconds >= 30
   from public.monitor_daily_stats
   where monitor_id = '79000000-0000-4000-8000-000000000001'
     and day = (now() at time zone 'utc')::date),
  'the gap since the previous heartbeat is recorded'
);

select is(
  (select count(*)::integer from public.monitor_daily_stats
   where monitor_id = '79000000-0000-4000-8000-000000000001'
     and day < (now() at time zone 'utc')::date - 90),
  0,
  'buckets older than 90 days are purged'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',
  '78000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.monitor_daily_stats),
  0,
  'another tenant cannot read the buckets'
);

select set_config('request.jwt.claim.sub',
  '78000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*)::integer from public.monitor_daily_stats),
  1,
  'a member reads the buckets of their own monitors'
);

select * from finish();

rollback;
