begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, email)
values
  ('87000000-0000-4000-8000-000000000001', 'report-a@example.test'),
  ('87000000-0000-4000-8000-000000000002', 'report-b@example.test');

select set_config(
  'test.tenant_a',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '87000000-0000-4000-8000-000000000001'),
  true
);
select set_config(
  'test.tenant_b',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '87000000-0000-4000-8000-000000000002'),
  true
);

-- Tenant A has a monitor with one incident and some activity; B has none.
insert into public.monitors (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, alert_at, name
)
values (
  '88000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_a')::uuid,
  repeat('8', 64), 'rep001', 60, 10, now() + interval '70 seconds',
  'Sync Stripe'
);

insert into public.incidents (id, tenant_id, monitor_id, opened_at)
values (
  '89000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_a')::uuid,
  '88000000-0000-4000-8000-000000000001',
  timestamptz '2026-11-02 09:30:00+00' - interval '2 days'
);

insert into public.monitor_daily_stats (
  monitor_id, tenant_id, day, pings, fails
)
values (
  '88000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_a')::uuid,
  date '2026-10-30', 10, 2
);

select is(
  (select count(*)::integer from public.claim_weekly_reports(
    timestamptz '2026-11-03 10:00:00+00')),
  0,
  'nothing is sent on a Tuesday'
);

select is(
  (select count(*)::integer from public.claim_weekly_reports(
    timestamptz '2026-11-02 08:59:00+00')),
  0,
  'nothing is sent on Monday before 09:00 UTC'
);

select is(
  (select count(*)::integer from public.claim_weekly_reports(
    timestamptz '2026-11-02 09:30:00+00')
   where tenant_id = current_setting('test.tenant_a')::uuid),
  1,
  'a tenant with monitors is claimed on Monday after 09:00 UTC'
);

select is(
  (select count(*)::integer from public.claim_weekly_reports(
    timestamptz '2026-11-02 09:31:00+00')
   where tenant_id = current_setting('test.tenant_a')::uuid),
  0,
  'a report is not claimed again while it is being sent'
);

select is(
  (select count(*)::integer from public.claim_weekly_reports(
    timestamptz '2026-11-02 09:45:00+00')
   where tenant_id = current_setting('test.tenant_a')::uuid),
  1,
  'a report that was never confirmed is retried after ten minutes'
);

select is(
  public.complete_weekly_report(
    current_setting('test.tenant_a')::uuid, date '2026-11-02', true),
  true,
  'the report can be confirmed as sent'
);

select is(
  (select count(*)::integer from public.claim_weekly_reports(
    timestamptz '2026-11-02 12:00:00+00')
   where tenant_id = current_setting('test.tenant_a')::uuid),
  0,
  'a sent report is never claimed twice in the same week'
);

delete from public.weekly_reports;

select ok(
  (select incidents_opened = 1
     and monitors_total = 1
     and pings_7d = 10
     and fails_7d = 2
     and problem_monitors -> 0 ->> 'name' = 'Sync Stripe'
   from public.claim_weekly_reports(timestamptz '2026-11-02 09:30:00+00')
   where tenant_id = current_setting('test.tenant_a')::uuid),
  'the report aggregates incidents, activity and problem monitors'
);

delete from public.weekly_reports;

insert into public.account_preferences (tenant_id, weekly_report_enabled)
values (current_setting('test.tenant_a')::uuid, false);

select is(
  (select count(*)::integer from public.claim_weekly_reports(
    timestamptz '2026-11-02 09:30:00+00')
   where tenant_id = current_setting('test.tenant_a')::uuid),
  0,
  'a tenant that disabled the report is skipped'
);

select is(
  (select count(*)::integer from public.claim_weekly_reports(
    timestamptz '2026-11-02 09:30:00+00')
   where tenant_id = current_setting('test.tenant_b')::uuid),
  0,
  'a tenant without monitors gets no report'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',
  '87000000-0000-4000-8000-000000000001', true);

select throws_ok(
  $$select * from public.weekly_reports$$,
  '42501',
  null,
  'clients cannot read the report ledger'
);

select * from finish();

rollback;
