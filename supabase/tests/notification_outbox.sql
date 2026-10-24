begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email)
values (
  'a1000000-0000-4000-8000-000000000001',
  'alerts@example.test'
);

select set_config(
  'test.tenant_id',
  (
    select tenant_id::text
    from public.tenant_memberships
    where user_id = 'a1000000-0000-4000-8000-000000000001'
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
  'a2000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_id')::uuid,
  repeat('d', 64),
  'outbox1',
  60,
  10,
  now() - interval '1 second'
);

select is(
  public.open_due_monitor_incidents(10),
  1,
  'the checker opens an incident and enqueues its alert'
);

select is(
  (
    select count(*)
    from public.notification_outbox
    where monitor_id = 'a2000000-0000-4000-8000-000000000001'
      and kind = 'incident_opened'
  ),
  1::bigint,
  'one incident-opened delivery is enqueued'
);

select is(
  public.open_due_monitor_incidents(10),
  0,
  'the repeated checker run is idempotent'
);

select is(
  (
    select count(*)
    from public.notification_outbox
    where monitor_id = 'a2000000-0000-4000-8000-000000000001'
      and kind = 'incident_opened'
  ),
  1::bigint,
  'the repeated checker does not duplicate the outbox event'
);

select is(
  (select count(*) from public.claim_notification_deliveries(10)),
  1::bigint,
  'the service can claim one pending delivery'
);

select set_config(
  'test.delivery_id',
  (
    select id::text
    from public.notification_outbox
    where monitor_id = 'a2000000-0000-4000-8000-000000000001'
      and kind = 'incident_opened'
  ),
  true
);

select is(
  public.complete_notification_delivery(
    current_setting('test.delivery_id')::uuid,
    true,
    null
  ),
  true,
  'a delivery can be marked sent'
);

select is(
  public.record_heartbeat(repeat('d', 64)),
  true,
  'a heartbeat resolves the incident'
);

select is(
  (
    select count(*)
    from public.notification_outbox
    where monitor_id = 'a2000000-0000-4000-8000-000000000001'
      and kind = 'incident_resolved'
  ),
  1::bigint,
  'one recovery delivery is enqueued'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_notification_deliveries(integer)',
    'execute'
  ),
  'anonymous clients cannot claim notification deliveries'
);

select * from finish();

rollback;
