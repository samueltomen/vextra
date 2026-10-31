begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

-- Three accounts: an owner, a future member (confirmed e-mail) and a stranger.
insert into auth.users (id, email, email_confirmed_at)
values
  ('ea000000-0000-4000-8000-000000000001', 'owner@example.test', now()),
  ('ea000000-0000-4000-8000-000000000002', 'guest@example.test', now()),
  ('ea000000-0000-4000-8000-000000000003', 'stranger@example.test', now());

select set_config('test.tenant',
  (select tenant_id::text from public.tenant_memberships
   where user_id = 'ea000000-0000-4000-8000-000000000001'), true);

insert into public.monitors (
  id, tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
  interval_seconds, grace_seconds, alert_at
)
values (
  'eb000000-0000-4000-8000-000000000001',
  current_setting('test.tenant')::uuid,
  repeat('1', 64), 'team01', 60, 10, now() + interval '70 seconds'
);

-- Owner invites the guest as a viewer ------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub',
  'ea000000-0000-4000-8000-000000000001', true);

select lives_ok(
  format($$insert into public.tenant_invitations
    (tenant_id, email, role, token_hash, invited_by)
    values (%L, 'guest@example.test', 'viewer', repeat('a', 64),
            'ea000000-0000-4000-8000-000000000001')$$,
    current_setting('test.tenant')),
  'the owner can invite someone'
);

select throws_ok(
  format($$insert into public.tenant_invitations
    (tenant_id, email, role, token_hash, invited_by)
    values (%L, 'guest@example.test', 'member', repeat('b', 64),
            'ea000000-0000-4000-8000-000000000001')$$,
    current_setting('test.tenant')),
  '23505', null,
  'only one pending invitation per address'
);

select throws_ok(
  format($$insert into public.tenant_invitations
    (tenant_id, email, role, token_hash, invited_by)
    values (%L, 'boss@example.test', 'owner', repeat('c', 64),
            'ea000000-0000-4000-8000-000000000001')$$,
    current_setting('test.tenant')),
  '23514', null,
  'an invitation cannot grant the owner role'
);

select throws_ok(
  $$select token_hash from public.tenant_invitations$$,
  '42501', null,
  'the invitation token hash is not readable by clients'
);

-- A stranger cannot use the guest invitation -----------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',
  'ea000000-0000-4000-8000-000000000003', true);

select is(
  public.accept_tenant_invitation(repeat('a', 64)),
  null::uuid,
  'an account with another e-mail cannot accept the invitation'
);

select is(
  (select count(*)::integer from public.tenant_invitations),
  0,
  'a non-owner sees no invitation'
);

-- The invited account accepts --------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',
  'ea000000-0000-4000-8000-000000000002', true);

select is(
  public.accept_tenant_invitation(repeat('a', 64)),
  current_setting('test.tenant')::uuid,
  'the invited account joins the space'
);

select is(
  public.accept_tenant_invitation(repeat('a', 64)),
  null::uuid,
  'an invitation is single use'
);

select is(
  (select role from public.tenant_memberships
   where user_id = 'ea000000-0000-4000-8000-000000000002'
     and tenant_id = current_setting('test.tenant')::uuid),
  'viewer',
  'the guest has the invited role'
);

-- A viewer reads but cannot write ----------------------------------------
select is(
  (select count(*)::integer from public.monitors
   where tenant_id = current_setting('test.tenant')::uuid),
  1,
  'a viewer can read the monitors of the space'
);

select throws_ok(
  format($$insert into public.monitors
    (tenant_id, heartbeat_token_hash, heartbeat_token_prefix,
     interval_seconds, grace_seconds, alert_at)
    values (%L, repeat('9', 64), 'team99', 60, 10, now())$$,
    current_setting('test.tenant')),
  '42501', null,
  'a viewer cannot create a monitor'
);

update public.monitors set name = 'hacked'
where id = 'eb000000-0000-4000-8000-000000000001';

select is(
  (select name from public.monitors
   where id = 'eb000000-0000-4000-8000-000000000001'),
  null,
  'a viewer cannot update a monitor'
);

select is(
  public.pause_monitor('eb000000-0000-4000-8000-000000000001'),
  false,
  'a viewer cannot pause a monitor'
);

select is(
  (select count(*)::integer from public.list_tenant_members(
     current_setting('test.tenant')::uuid)),
  2,
  'a viewer can list the members'
);

select throws_ok(
  format($$select public.set_member_role(%L,
    'ea000000-0000-4000-8000-000000000002', 'member')$$,
    current_setting('test.tenant')),
  '42501', null,
  'a viewer cannot change roles'
);

-- The owner promotes the guest, who can then write -----------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',
  'ea000000-0000-4000-8000-000000000001', true);

select is(
  public.set_member_role(current_setting('test.tenant')::uuid,
    'ea000000-0000-4000-8000-000000000002', 'member'),
  true,
  'the owner can change a role'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',
  'ea000000-0000-4000-8000-000000000002', true);

select is(
  public.pause_monitor('eb000000-0000-4000-8000-000000000001'),
  true,
  'a member can pause a monitor'
);

select throws_ok(
  format($$insert into public.tenant_invitations
    (tenant_id, email, role, token_hash, invited_by)
    values (%L, 'x@example.test', 'member', repeat('d', 64),
            'ea000000-0000-4000-8000-000000000002')$$,
    current_setting('test.tenant')),
  '42501', null,
  'a member cannot invite'
);

-- Leaving, and ownership transfer ----------------------------------------
select is(
  public.remove_tenant_member(current_setting('test.tenant')::uuid,
    'ea000000-0000-4000-8000-000000000002'),
  true,
  'a member can leave the space'
);

reset role;

insert into public.tenant_memberships (tenant_id, user_id, role)
values (current_setting('test.tenant')::uuid,
        'ea000000-0000-4000-8000-000000000002', 'member');
delete from public.tenant_memberships
where tenant_id = current_setting('test.tenant')::uuid
  and user_id = 'ea000000-0000-4000-8000-000000000001';

select is(
  (select role from public.tenant_memberships
   where tenant_id = current_setting('test.tenant')::uuid
     and user_id = 'ea000000-0000-4000-8000-000000000002'),
  'owner',
  'when the owner leaves, the remaining member inherits the space'
);

select * from finish();

rollback;
