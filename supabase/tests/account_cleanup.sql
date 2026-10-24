begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email)
values (
  'c1000000-0000-4000-8000-000000000001',
  'delete-me@example.test'
);

select set_config(
  'test.tenant_id',
  (
    select tenant_id::text
    from public.tenant_memberships
    where user_id = 'c1000000-0000-4000-8000-000000000001'
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
  'c2000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_id')::uuid,
  repeat('e', 64),
  'delete1',
  60,
  10,
  now() - interval '1 minute'
);

insert into public.incidents (
  tenant_id,
  monitor_id,
  opened_at
)
values (
  current_setting('test.tenant_id')::uuid,
  'c2000000-0000-4000-8000-000000000001',
  now() - interval '1 minute'
);

insert into public.notification_outbox (
  tenant_id,
  monitor_id,
  incident_id,
  kind,
  idempotency_key
)
select
  incident.tenant_id,
  incident.monitor_id,
  incident.id,
  'incident_opened',
  'incident_opened:' || incident.id::text
from public.incidents as incident
where incident.monitor_id = 'c2000000-0000-4000-8000-000000000001';

delete from auth.users
where id = 'c1000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)
    from public.tenant_memberships
    where user_id = 'c1000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'account deletion removes memberships'
);

select is(
  (
    select count(*)
    from public.tenants
    where id = current_setting('test.tenant_id')::uuid
  ),
  0::bigint,
  'account deletion removes the empty tenant'
);

select is(
  (
    select count(*)
    from public.monitors
    where tenant_id = current_setting('test.tenant_id')::uuid
  ),
  0::bigint,
  'account deletion cascades monitors'
);

select is(
  (
    select count(*)
    from public.incidents
    where tenant_id = current_setting('test.tenant_id')::uuid
  ),
  0::bigint,
  'account deletion cascades incidents'
);

select is(
  (
    select count(*)
    from public.notification_outbox
    where tenant_id = current_setting('test.tenant_id')::uuid
  ),
  0::bigint,
  'account deletion cascades notification deliveries'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'tenant_membership_deletes_empty_tenant'
      and not tgisinternal
  ),
  'the empty-tenant cleanup trigger is installed'
);

select * from finish();

rollback;
