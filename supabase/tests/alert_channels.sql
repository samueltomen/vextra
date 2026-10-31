begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email)
values
  ('83000000-0000-4000-8000-000000000001', 'chan-a@example.test'),
  ('83000000-0000-4000-8000-000000000002', 'chan-b@example.test');

select set_config(
  'test.tenant_a',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '83000000-0000-4000-8000-000000000001'),
  true
);

insert into public.monitors (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, alert_at
)
values (
  '84000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_a')::uuid,
  repeat('7', 64), 'chan001', 60, 10, now() + interval '70 seconds'
);

insert into public.incidents (id, tenant_id, monitor_id, opened_at)
values (
  '85000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_a')::uuid,
  '84000000-0000-4000-8000-000000000001',
  now() - interval '3 hours'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$insert into public.notification_channels
      (tenant_id, kind, name, target, target_hint)
    values (current_setting('test.tenant_a')::uuid, 'slack', 'Équipe ops',
            'https://hooks.slack.com/services/T000/B000/SECRET',
            'hooks.slack.com/…CRET')$$,
  'a member can create a channel'
);

select throws_ok(
  $$select target from public.notification_channels$$,
  '42501',
  null,
  'the channel target can never be read back by a client'
);

select is(
  (select target_hint from public.notification_channels),
  'hooks.slack.com/…CRET',
  'a client reads only the masked hint'
);

select throws_ok(
  $$insert into public.notification_channels
      (tenant_id, kind, name, target, target_hint)
    values (current_setting('test.tenant_a')::uuid, 'discord', ' équipe OPS ',
            'https://discord.com/api/webhooks/1/x', 'discord.com/…/x')$$,
  '23505',
  null,
  'channel names are unique per tenant'
);

select set_config('request.jwt.claim.sub',
  '83000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.notification_channels),
  0,
  'another tenant cannot see the channels'
);

reset role;

insert into public.notification_channels
  (tenant_id, kind, name, target, target_hint, enabled)
values (current_setting('test.tenant_a')::uuid, 'webhook', 'Désactivé',
        'https://example.test/hook', 'example.test', false);

insert into public.notification_outbox (
  tenant_id, monitor_id, incident_id, kind, idempotency_key
)
values (
  current_setting('test.tenant_a')::uuid,
  '84000000-0000-4000-8000-000000000001',
  '85000000-0000-4000-8000-000000000001',
  'incident_opened', 'chan:opened'
);

select is(
  (select count(*)::integer from public.channel_outbox),
  1,
  'an alert is fanned out to enabled channels only'
);

select is(
  (select count(*)::integer from public.claim_channel_deliveries(10)
   where channel_kind = 'slack'
     and target like 'https://hooks.slack.com/%'
     and kind = 'incident_opened'),
  1,
  'the service claims the delivery with its secret target'
);

select is(
  (select status from public.channel_outbox),
  'processing',
  'a claimed delivery is marked as processing'
);

select is(
  public.complete_channel_delivery(
    (select id from public.channel_outbox), true, null),
  true,
  'the delivery can be completed'
);

update public.monitors
set alerts_enabled = false
where id = '84000000-0000-4000-8000-000000000001';

insert into public.notification_outbox (
  tenant_id, monitor_id, incident_id, kind, idempotency_key
)
values (
  current_setting('test.tenant_a')::uuid,
  '84000000-0000-4000-8000-000000000001',
  '85000000-0000-4000-8000-000000000001',
  'incident_resolved', 'chan:resolved'
);

select is(
  (select count(*)::integer from public.claim_channel_deliveries(10)),
  0,
  'a muted monitor does not deliver to channels'
);

update public.monitors
set alerts_enabled = true
where id = '84000000-0000-4000-8000-000000000001';

insert into public.account_preferences
  (tenant_id, reminder_interval_minutes)
values (current_setting('test.tenant_a')::uuid, 60);

select is(
  public.enqueue_incident_reminders(),
  1,
  'an incident open for more than the interval gets one reminder'
);

select is(
  public.enqueue_incident_reminders(),
  0,
  'no second reminder is sent before the next interval'
);

select is(
  (select count(*)::integer from public.channel_outbox
   where kind = 'reminder'),
  1,
  'the reminder is fanned out to the enabled channel'
);

select * from finish();

rollback;
