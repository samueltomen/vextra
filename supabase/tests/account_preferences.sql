begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, email)
values
  ('7a000000-0000-4000-8000-000000000001', 'prefs-a@example.test'),
  ('7a000000-0000-4000-8000-000000000002', 'prefs-b@example.test');

select set_config(
  'test.tenant_a',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '7a000000-0000-4000-8000-000000000001'),
  true
);
select set_config(
  'test.tenant_b',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '7a000000-0000-4000-8000-000000000002'),
  true
);

insert into public.monitors (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, alert_at
)
values (
  '7b000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_a')::uuid,
  repeat('2', 64), 'pref01', 60, 10, now() + interval '70 seconds'
);

insert into public.incidents (id, tenant_id, monitor_id, opened_at, resolved_at,
  resolution_reason)
values
  ('7c000000-0000-4000-8000-000000000001',
   current_setting('test.tenant_a')::uuid,
   '7b000000-0000-4000-8000-000000000001',
   now() - interval '2 hours', now() - interval '1 hour', 'heartbeat_received');

insert into public.notification_outbox (
  tenant_id, monitor_id, incident_id, kind, idempotency_key
)
values
  (current_setting('test.tenant_a')::uuid,
   '7b000000-0000-4000-8000-000000000001',
   '7c000000-0000-4000-8000-000000000001',
   'incident_opened', 'prefs:opened'),
  (current_setting('test.tenant_a')::uuid,
   '7b000000-0000-4000-8000-000000000001',
   '7c000000-0000-4000-8000-000000000001',
   'incident_resolved', 'prefs:resolved');

set local role authenticated;
select set_config('request.jwt.claim.sub',
  '7a000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$insert into public.account_preferences
      (tenant_id, display_name, timezone, notify_on_resolve)
    values (current_setting('test.tenant_a')::uuid,
            'Alice', 'America/New_York', false)$$,
  'a member can store their preferences'
);

select throws_ok(
  $$update public.account_preferences set timezone = 'Mars/Olympus'$$,
  '22023',
  null,
  'an unknown timezone is rejected'
);

select throws_ok(
  $$insert into public.account_preferences (tenant_id)
    values (current_setting('test.tenant_b')::uuid)$$,
  '42501',
  null,
  'a member cannot write the preferences of another tenant'
);

select is(
  (select count(*)::integer from public.account_preferences),
  1,
  'a member only reads the preferences of their tenant'
);

reset role;

select is(
  (select count(*)::integer from public.claim_notification_deliveries(10)),
  1,
  'only the alerts enabled by the preferences are claimed'
);

select is(
  (select status from public.notification_outbox
   where idempotency_key = 'prefs:resolved'),
  'skipped',
  'a disabled alert kind is marked skipped'
);

select is(
  (select last_error_code from public.notification_outbox
   where idempotency_key = 'prefs:resolved'),
  'preference_disabled',
  'the skip reason is recorded'
);

select is(
  (select status from public.notification_outbox
   where idempotency_key = 'prefs:opened'),
  'processing',
  'an enabled alert kind is delivered normally'
);

select * from finish();

rollback;
