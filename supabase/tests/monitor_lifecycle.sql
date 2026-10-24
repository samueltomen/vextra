begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email)
values (
  '70000000-0000-4000-8000-000000000001',
  'lifecycle@example.test'
);

select set_config(
  'test.tenant_id',
  (
    select tenant_id::text
    from public.tenant_memberships
    where user_id = '70000000-0000-4000-8000-000000000001'
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
  '80000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_id')::uuid,
  repeat('c', 64),
  'lifecyc',
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
  '80000000-0000-4000-8000-000000000001',
  now() - interval '1 minute',
  'heartbeat_missed'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000001',
  true
);

select is(
  public.pause_monitor('80000000-0000-4000-8000-000000000001'),
  true,
  'a tenant member can pause their monitor'
);

select is(
  (
    select status
    from public.monitors
    where id = '80000000-0000-4000-8000-000000000001'
  ),
  'paused',
  'the monitor becomes paused'
);

select isnt(
  (
    select resolved_at
    from public.incidents
    where monitor_id = '80000000-0000-4000-8000-000000000001'
  ),
  null::timestamptz,
  'pause closes the open incident'
);

select is(
  public.resume_monitor('80000000-0000-4000-8000-000000000001'),
  true,
  'a tenant member can resume their monitor'
);

select is(
  (
    select status
    from public.monitors
    where id = '80000000-0000-4000-8000-000000000001'
  ),
  'pending',
  'a monitor without heartbeats resumes as pending'
);

select is(
  public.delete_monitor('80000000-0000-4000-8000-000000000001'),
  true,
  'a tenant member can delete their monitor'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.pause_monitor(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.delete_monitor(uuid)',
    'execute'
  ),
  'anonymous clients cannot use lifecycle RPCs'
);

select * from finish();

rollback;
