begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email)
values
  ('7d000000-0000-4000-8000-000000000001', 'details-a@example.test'),
  ('7d000000-0000-4000-8000-000000000002', 'details-b@example.test');

select set_config(
  'test.tenant_a',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '7d000000-0000-4000-8000-000000000001'),
  true
);
select set_config(
  'test.tenant_b',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '7d000000-0000-4000-8000-000000000002'),
  true
);

insert into public.monitor_folders (id, tenant_id, name)
values (
  '7e000000-0000-4000-8000-00000000000b',
  current_setting('test.tenant_b')::uuid,
  'Folder of B'
);

insert into public.monitors (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, alert_at, name
)
values
  ('7f000000-0000-4000-8000-000000000001',
   current_setting('test.tenant_a')::uuid,
   repeat('3', 64), 'detail01', 60, 10, now() + interval '70 seconds',
   'Sauvegarde nocturne'),
  ('7f000000-0000-4000-8000-000000000002',
   current_setting('test.tenant_a')::uuid,
   repeat('4', 64), 'detail02', 60, 10, now() + interval '70 seconds',
   null);

update public.monitors
set alerts_enabled = false
where id = '7f000000-0000-4000-8000-000000000002';

insert into public.incidents (id, tenant_id, monitor_id, opened_at)
values
  ('80000000-0000-4000-8000-000000000001',
   current_setting('test.tenant_a')::uuid,
   '7f000000-0000-4000-8000-000000000001', now()),
  ('80000000-0000-4000-8000-000000000002',
   current_setting('test.tenant_a')::uuid,
   '7f000000-0000-4000-8000-000000000002', now() - interval '1 hour');

update public.incidents
set resolved_at = now() - interval '30 minutes',
    resolution_reason = 'manual'
where id = '80000000-0000-4000-8000-000000000002';

insert into public.notification_outbox (
  tenant_id, monitor_id, incident_id, kind, idempotency_key
)
values
  (current_setting('test.tenant_a')::uuid,
   '7f000000-0000-4000-8000-000000000001',
   '80000000-0000-4000-8000-000000000001',
   'incident_opened', 'details:named'),
  (current_setting('test.tenant_a')::uuid,
   '7f000000-0000-4000-8000-000000000002',
   '80000000-0000-4000-8000-000000000002',
   'incident_opened', 'details:muted');

set local role authenticated;
select set_config('request.jwt.claim.sub',
  '7d000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$update public.monitors
    set name = 'Sync Stripe', description = 'Toutes les heures',
        notes = 'Voir le runbook', alerts_enabled = true
    where id = '7f000000-0000-4000-8000-000000000001'$$,
  'a member can edit the name, description, notes and alert switch'
);

select throws_ok(
  $$update public.monitors set name = repeat('x', 81)
    where id = '7f000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'a name longer than 80 characters is rejected'
);

select throws_ok(
  $$update public.monitors set notes = repeat('x', 2001)
    where id = '7f000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'notes longer than 2000 characters are rejected'
);

select lives_ok(
  $$insert into public.account_preferences
      (tenant_id, time_format, density, default_view, default_sort,
       default_interval_minutes, default_grace_minutes)
    values (current_setting('test.tenant_a')::uuid,
            '12h', 'comfortable', 'grid', 'name', 15, 2)$$,
  'a member can store display preferences and new-monitor defaults'
);

select throws_ok(
  $$update public.account_preferences set time_format = '48h'$$,
  '23514',
  null,
  'an unknown time format is rejected'
);

select throws_ok(
  $$update public.account_preferences
    set default_folder_id = '7e000000-0000-4000-8000-00000000000b'$$,
  '23503',
  null,
  'the default folder must belong to the same tenant'
);

select set_config('request.jwt.claim.sub',
  '7d000000-0000-4000-8000-000000000002', true);

select is(
  (select count(*)::integer from public.monitors),
  0,
  'another tenant cannot read these monitors'
);

reset role;

select is(
  (select count(*)::integer from public.claim_notification_deliveries(100)
   where monitor_id in (
     '7f000000-0000-4000-8000-000000000001',
     '7f000000-0000-4000-8000-000000000002')),
  1,
  'only the alert of an unmuted monitor is claimed'
);

select is(
  (select last_error_code from public.notification_outbox
   where idempotency_key = 'details:muted'),
  'monitor_muted',
  'the alert of a muted monitor is skipped with a reason'
);

select is(
  (select status from public.notification_outbox
   where idempotency_key = 'details:named'),
  'processing',
  'the alert of an unmuted monitor is delivered'
);

select * from finish();

rollback;
