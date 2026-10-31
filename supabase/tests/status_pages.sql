begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email)
values
  ('8a000000-0000-4000-8000-000000000001', 'status-a@example.test'),
  ('8a000000-0000-4000-8000-000000000002', 'status-b@example.test');

select set_config('test.tenant_a',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '8a000000-0000-4000-8000-000000000001'), true);
select set_config('test.tenant_b',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '8a000000-0000-4000-8000-000000000002'), true);

insert into public.monitors (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, alert_at, name, created_at
)
values
  ('8b000000-0000-4000-8000-000000000001', current_setting('test.tenant_a')::uuid,
   repeat('1', 64), 'stat01', 60, 10, now() + interval '70 seconds', 'API publique',
   now() - interval '10 days'),
  ('8b000000-0000-4000-8000-000000000002', current_setting('test.tenant_a')::uuid,
   repeat('2', 64), 'stat02', 60, 10, now() + interval '70 seconds', 'Secret interne',
   now() - interval '10 days'),
  ('8b000000-0000-4000-8000-000000000003', current_setting('test.tenant_b')::uuid,
   repeat('3', 64), 'stat03', 60, 10, now() + interval '70 seconds', 'Autre tenant',
   now() - interval '10 days');

insert into public.incidents (tenant_id, monitor_id, opened_at, resolved_at,
  resolution_reason)
values (current_setting('test.tenant_a')::uuid,
  '8b000000-0000-4000-8000-000000000001',
  now() - interval '2 days', now() - interval '2 days' + interval '1 day',
  'heartbeat_received');

set local role authenticated;
select set_config('request.jwt.claim.sub',
  '8a000000-0000-4000-8000-000000000001', true);

select lives_ok(
  format($$select public.save_status_page(%L, 'acme-status', 'Acme', null, true,
    array['8b000000-0000-4000-8000-000000000001']::uuid[])$$,
    current_setting('test.tenant_a')),
  'a member can publish a status page'
);

select throws_ok(
  format($$select public.save_status_page(%L, 'hijack', 'Nope', null, true,
    array[]::uuid[])$$, current_setting('test.tenant_b')),
  '42501',
  null,
  'a member cannot write the status page of another tenant'
);

select throws_ok(
  format($$select public.save_status_page(%L, 'Bad Slug!', 'Acme', null, true,
    array[]::uuid[])$$, current_setting('test.tenant_a')),
  '23514',
  null,
  'an invalid slug is rejected'
);

select is(
  (select show_on_status_page from public.monitors
   where id = '8b000000-0000-4000-8000-000000000002'),
  false,
  'monitors that were not selected stay private'
);

select is(
  (select count(*)::integer from public.monitors
   where show_on_status_page and tenant_id <> current_setting('test.tenant_a')::uuid),
  0,
  'no monitor of another tenant is ever exposed'
);

reset role;
set local role anon;

select is(
  (select jsonb_array_length(public.get_public_status_page('acme-status') -> 'monitors')),
  1,
  'the public page lists only the selected monitors'
);

select is(
  (select public.get_public_status_page('acme-status') -> 'monitors' -> 0 ->> 'name'),
  'API publique',
  'the public page shows the monitor name'
);

select ok(
  (select (public.get_public_status_page('acme-status') -> 'monitors' -> 0 ->> 'uptime30d')::numeric
     between 85 and 95),
  'availability accounts for the resolved incident (about 1 day out of 10)'
);

select is(
  (select position('8b000000' in public.get_public_status_page('acme-status')::text)),
  0,
  'identifiers are never exposed'
);

select is(
  public.get_public_status_page('unknown-page'),
  null::jsonb,
  'an unknown or disabled page returns nothing'
);

select * from finish();

rollback;
