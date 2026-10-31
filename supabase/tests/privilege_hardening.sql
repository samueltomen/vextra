begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

-- Behaviour under test: the database privileges of client roles match the
-- documented intent (migration 20261031230000). No existing test covers
-- privileges, only row policies.

select ok(
  not has_table_privilege('authenticated', 'public.monitors', 'TRUNCATE'),
  'authenticated cannot truncate monitors (RLS does not cover TRUNCATE)'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
  ),
  'no client role holds TRUNCATE, TRIGGER or REFERENCES on public tables'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'
  ),
  'anon holds no table privilege in public'
);

select ok(
  not has_column_privilege(
    'authenticated', 'public.monitors', 'heartbeat_token_hash', 'SELECT'),
  'the heartbeat token hash is not readable by clients'
);

select ok(
  has_column_privilege(
    'authenticated', 'public.monitors', 'heartbeat_token_hash', 'INSERT'),
  'the hash can still be written at creation'
);

select ok(
  not has_column_privilege(
    'authenticated', 'public.monitors', 'total_pings', 'UPDATE')
  and not has_column_privilege(
    'authenticated', 'public.monitors', 'status', 'UPDATE')
  and not has_column_privilege(
    'authenticated', 'public.monitors', 'alert_at', 'UPDATE'),
  'monitor state columns cannot be updated directly by clients'
);

select ok(
  has_column_privilege('authenticated', 'public.monitors', 'name', 'UPDATE')
  and has_column_privilege('authenticated', 'public.monitors', 'tags', 'UPDATE'),
  'descriptive monitor columns remain editable'
);

select ok(
  not has_table_privilege('authenticated', 'public.tenant_memberships', 'INSERT')
  and not has_table_privilege('authenticated', 'public.tenant_memberships', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.tenant_memberships', 'DELETE'),
  'memberships cannot be written directly (functions only)'
);

select ok(
  not has_table_privilege('authenticated', 'public.incidents', 'INSERT')
  and not has_table_privilege('authenticated', 'public.notification_outbox', 'INSERT'),
  'incidents and the outbox are not writable by clients'
);

select ok(
  not has_function_privilege(
    'authenticated', 'public.authenticate_api_key(text)', 'EXECUTE')
  and not has_function_privilege(
    'authenticated', 'public.open_due_monitor_incidents(integer)', 'EXECUTE')
  and not has_function_privilege(
    'anon', 'public.claim_notification_deliveries(integer)', 'EXECUTE'),
  'service-only functions are closed to client roles'
);

select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ),
  'every public table has row level security enabled'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) setting
        where setting like 'search_path=%'
      )
  ),
  'every security definer function pins its search_path'
);

select * from finish();

rollback;
