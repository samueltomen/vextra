begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email)
values (
  '40000000-0000-4000-8000-000000000001',
  'heartbeat@example.test'
);

select set_config(
  'test.tenant_id',
  (
    select tenant_id::text
    from public.tenant_memberships
    where user_id = '40000000-0000-4000-8000-000000000001'
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
  status,
  incident_opened_at
)
values (
  '50000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_id')::uuid,
  repeat('a', 64),
  'heartbe',
  60,
  10,
  now() - interval '1 minute',
  'late',
  now() - interval '1 minute'
);

insert into public.incidents (
  tenant_id,
  monitor_id,
  opened_at,
  reason
)
values (
  current_setting('test.tenant_id')::uuid,
  '50000000-0000-4000-8000-000000000001',
  now() - interval '1 minute',
  'heartbeat_missed'
);

select is(
  public.record_heartbeat('not-a-valid-hash'),
  false,
  'malformed token hashes are rejected'
);

select is(
  public.record_heartbeat(repeat('f', 64)),
  false,
  'unknown token hashes are rejected'
);

select is(
  public.record_heartbeat(repeat('a', 64)),
  true,
  'a known hash records the heartbeat'
);

select is(
  (
    select status
    from public.monitors
    where id = '50000000-0000-4000-8000-000000000001'
  ),
  'healthy',
  'the monitor becomes healthy'
);

select is(
  (
    select incident_opened_at
    from public.monitors
    where id = '50000000-0000-4000-8000-000000000001'
  ),
  null::timestamptz,
  'the current incident marker is cleared'
);

select isnt(
  (
    select resolved_at
    from public.incidents
    where monitor_id = '50000000-0000-4000-8000-000000000001'
  ),
  null::timestamptz,
  'the incident is resolved'
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
  '50000000-0000-4000-8000-000000000002',
  current_setting('test.tenant_id')::uuid,
  repeat('b', 64),
  'overdue',
  60,
  10,
  now() - interval '1 second'
);

select is(
  public.open_due_monitor_incidents(10),
  1,
  'the checker opens one due incident'
);

select is(
  (
    select status
    from public.monitors
    where id = '50000000-0000-4000-8000-000000000002'
  ),
  'late',
  'the overdue monitor becomes late'
);

select is(
  (
    select count(*)
    from public.incidents
    where monitor_id = '50000000-0000-4000-8000-000000000002'
      and resolved_at is null
  ),
  1::bigint,
  'exactly one open incident is created'
);

select is(
  public.open_due_monitor_incidents(10),
  0,
  'a repeated checker run is idempotent'
);

select is(
  (
    select count(*)
    from public.incidents
    where monitor_id = '50000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'the repeated run creates no duplicate incident'
);

select ok(
  has_function_privilege(
    'anon',
    'public.record_heartbeat(text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.open_due_monitor_incidents(integer)',
    'execute'
  ),
  'public heartbeat is allowed while the due checker stays private'
);

select * from finish();

rollback;
