begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email)
values
  ('ca000000-0000-4000-8000-000000000001', 'maint-a@example.test'),
  ('ca000000-0000-4000-8000-000000000002', 'maint-b@example.test');

select set_config('test.tenant_a',
  (select tenant_id::text from public.tenant_memberships
   where user_id = 'ca000000-0000-4000-8000-000000000001'), true);
select set_config('test.tenant_b',
  (select tenant_id::text from public.tenant_memberships
   where user_id = 'ca000000-0000-4000-8000-000000000002'), true);

-- Two overdue monitors of tenant A: one covered by a window, one not.
insert into public.monitors (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, alert_at
)
values
  ('cb000000-0000-4000-8000-000000000001', current_setting('test.tenant_a')::uuid,
   repeat('1', 64), 'mnt001', 60, 10, now() - interval '1 minute'),
  ('cb000000-0000-4000-8000-000000000002', current_setting('test.tenant_a')::uuid,
   repeat('2', 64), 'mnt002', 60, 10, now() - interval '1 minute'),
  ('cb000000-0000-4000-8000-000000000003', current_setting('test.tenant_b')::uuid,
   repeat('3', 64), 'mnt003', 60, 10, now() - interval '1 minute');

set local role authenticated;
select set_config('request.jwt.claim.sub',
  'ca000000-0000-4000-8000-000000000001', true);

select lives_ok(
  format($$insert into public.maintenance_windows
    (tenant_id, monitor_id, name, starts_at, ends_at)
    values (%L, 'cb000000-0000-4000-8000-000000000001', 'Migration',
            now() - interval '5 minutes', now() + interval '1 hour')$$,
    current_setting('test.tenant_a')),
  'a member can plan a maintenance window for one monitor'
);

select throws_ok(
  format($$insert into public.maintenance_windows
    (tenant_id, name, starts_at, ends_at)
    values (%L, 'Foreign', now(), now() + interval '1 hour')$$,
    current_setting('test.tenant_b')),
  '42501', null,
  'a member cannot plan a window for another tenant'
);

select throws_ok(
  format($$insert into public.maintenance_windows
    (tenant_id, name, starts_at, ends_at)
    values (%L, 'Inverted', now() + interval '2 hours', now() + interval '1 hour')$$,
    current_setting('test.tenant_a')),
  '23514', null,
  'a window must end after it starts'
);

select throws_ok(
  format($$insert into public.maintenance_windows
    (tenant_id, name, starts_at, ends_at)
    values (%L, 'Endless', now(), now() + interval '31 days')$$,
    current_setting('test.tenant_a')),
  '23514', null,
  'a window cannot exceed 30 days'
);

select is(
  (select count(*)::integer from public.maintenance_windows),
  1,
  'a member only sees the windows of their tenant'
);

reset role;

select ok(
  public.is_in_maintenance(
    current_setting('test.tenant_a')::uuid,
    'cb000000-0000-4000-8000-000000000001', now()),
  'the covered monitor is in maintenance'
);

select ok(
  not public.is_in_maintenance(
    current_setting('test.tenant_a')::uuid,
    'cb000000-0000-4000-8000-000000000002', now()),
  'another monitor of the tenant is not'
);

select public.open_due_monitor_incidents(1000);

select is(
  (select status from public.monitors
   where id = 'cb000000-0000-4000-8000-000000000001'),
  'pending',
  'no incident is opened for a monitor under maintenance'
);

select is(
  (select status from public.monitors
   where id = 'cb000000-0000-4000-8000-000000000002'),
  'late',
  'monitors outside any window still alert'
);

select * from finish();

rollback;
