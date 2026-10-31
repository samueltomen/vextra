begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email)
values
  ('75000000-0000-4000-8000-000000000001', 'folders-a@example.test'),
  ('75000000-0000-4000-8000-000000000002', 'folders-b@example.test');

select set_config(
  'test.tenant_a',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '75000000-0000-4000-8000-000000000001'),
  true
);
select set_config(
  'test.tenant_b',
  (select tenant_id::text from public.tenant_memberships
   where user_id = '75000000-0000-4000-8000-000000000002'),
  true
);

insert into public.monitor_folders (id, tenant_id, name)
values (
  '76000000-0000-4000-8000-00000000000b',
  current_setting('test.tenant_b')::uuid,
  'Folder of B'
);

insert into public.monitors (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, alert_at
)
values (
  '77000000-0000-4000-8000-000000000001',
  current_setting('test.tenant_a')::uuid,
  repeat('1', 64), 'fold01', 60, 10, now() + interval '70 seconds'
);

select throws_ok(
  $$update public.monitors
    set folder_id = '76000000-0000-4000-8000-00000000000b'
    where id = '77000000-0000-4000-8000-000000000001'$$,
  '23503',
  null,
  'a monitor cannot be filed in a folder of another tenant'
);

set local role authenticated;
select set_config('request.jwt.claim.sub',
  '75000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$insert into public.monitor_folders (id, tenant_id, name)
    values ('76000000-0000-4000-8000-00000000000a',
            current_setting('test.tenant_a')::uuid, 'Production')$$,
  'a member can create a folder in their tenant'
);

select throws_ok(
  $$insert into public.monitor_folders (tenant_id, name)
    values (current_setting('test.tenant_a')::uuid, '  production ')$$,
  '23505',
  null,
  'folder names are unique per tenant, ignoring case and spaces'
);

select throws_ok(
  $$insert into public.monitor_folders (tenant_id, name)
    values (current_setting('test.tenant_b')::uuid, 'Intruder')$$,
  '42501',
  null,
  'a member cannot create a folder in another tenant'
);

select is(
  (select count(*)::integer from public.monitor_folders),
  1,
  'a member only sees the folders of their own tenant'
);

select lives_ok(
  $$update public.monitors
    set folder_id = '76000000-0000-4000-8000-00000000000a'
    where id = '77000000-0000-4000-8000-000000000001'$$,
  'a member can file their monitor in their folder'
);

select is(
  (select folder_id::text from public.monitors
   where id = '77000000-0000-4000-8000-000000000001'),
  '76000000-0000-4000-8000-00000000000a',
  'the folder assignment is persisted'
);

delete from public.monitor_folders
where id = '76000000-0000-4000-8000-00000000000a';

select is(
  (select folder_id from public.monitors
   where id = '77000000-0000-4000-8000-000000000001'),
  null,
  'deleting a folder keeps its monitors and clears their folder'
);

reset role;
insert into public.monitor_folders (tenant_id, name)
select current_setting('test.tenant_a')::uuid, 'F' || n
from generate_series(1, 50) as n;

select throws_ok(
  $$insert into public.monitor_folders (tenant_id, name)
    values (current_setting('test.tenant_a')::uuid, 'One too many')$$,
  '54000',
  null,
  'a tenant cannot exceed 50 folders'
);

select * from finish();

rollback;
