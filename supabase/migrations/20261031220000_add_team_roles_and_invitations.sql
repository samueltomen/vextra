-- Forward-only migration. Production rollback requires a new migration.
-- Teams: roles (owner / member / viewer), write protection for viewers,
-- invitations by single-use link, member management.

-- 1. Roles ---------------------------------------------------------------
alter table public.tenant_memberships
  drop constraint tenant_memberships_role_check;

update public.tenant_memberships set role = 'member' where role = 'admin';

alter table public.tenant_memberships
  add constraint tenant_memberships_role_check
  check (role in ('owner', 'member', 'viewer'));

create or replace function public.can_write_tenant(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where tenant_id = target_tenant_id
      and user_id = (select auth.uid())
      and role in ('owner', 'member')
  );
$$;

create or replace function public.is_tenant_owner(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where tenant_id = target_tenant_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

revoke all on function public.can_write_tenant(uuid) from public, anon;
revoke all on function public.is_tenant_owner(uuid) from public, anon;
grant execute on function public.can_write_tenant(uuid) to authenticated;
grant execute on function public.is_tenant_owner(uuid) to authenticated;

-- 2. Viewers are read-only: every write policy and every membership-checking
-- write function now requires a writer role. Reads keep is_tenant_member.
do $$
declare
  policy_row record;
  statement text;
begin
  for policy_row in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and cmd <> 'SELECT'
      and (coalesce(qual, '') || coalesce(with_check, ''))
        like '%is_tenant_member%'
  loop
    statement := format(
      'alter policy %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );

    if policy_row.qual is not null then
      statement := statement || format(
        ' using (%s)',
        replace(policy_row.qual, 'is_tenant_member', 'can_write_tenant')
      );
    end if;

    if policy_row.with_check is not null then
      statement := statement || format(
        ' with check (%s)',
        replace(policy_row.with_check, 'is_tenant_member', 'can_write_tenant')
      );
    end if;

    execute statement;
  end loop;
end;
$$;

do $$
declare
  function_oid oid;
begin
  for function_oid in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'delete_monitor', 'pause_monitor', 'resume_monitor',
        'rotate_monitor_token', 'update_monitor_schedule_v2',
        'update_monitor_schedule'
      )
      and p.prosrc like '%is_tenant_member%'
  loop
    execute replace(
      pg_get_functiondef(function_oid),
      'is_tenant_member',
      'can_write_tenant'
    );
  end loop;
end;
$$;

-- 3. Ownership never gets lost: when the owner leaves a shared space, the
-- longest-standing remaining member inherits it; an empty space is removed.
create or replace function public.delete_empty_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;

  if old.role = 'owner' and not exists (
    select 1 from public.tenant_memberships
    where tenant_id = old.tenant_id and role = 'owner'
  ) then
    update public.tenant_memberships
    set role = 'owner'
    where (tenant_id, user_id) = (
      select tenant_id, user_id
      from public.tenant_memberships
      where tenant_id = old.tenant_id
      order by (role = 'member') desc, created_at
      limit 1
    );
  end if;

  delete from public.tenants
  where id = old.tenant_id
    and not exists (
      select 1
      from public.tenant_memberships
      where tenant_id = old.tenant_id
    );

  return old;
end;
$$;

-- 4. Invitations ---------------------------------------------------------
create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null check (
    email = lower(email) and char_length(email) between 3 and 254
  ),
  role text not null check (role in ('member', 'viewer')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz
);

create unique index tenant_invitations_pending_uidx
  on public.tenant_invitations (tenant_id, email)
  where accepted_at is null and revoked_at is null;

create or replace function public.enforce_invitation_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from public.tenant_invitations
    where tenant_id = new.tenant_id
      and accepted_at is null and revoked_at is null
      and expires_at > now()
  ) >= 20 then
    raise exception 'invitation limit reached' using errcode = '54000';
  end if;

  return new;
end;
$$;

create trigger tenant_invitations_limit
before insert on public.tenant_invitations
for each row
execute function public.enforce_invitation_limit();

alter table public.tenant_invitations enable row level security;

create policy tenant_invitations_select_owner
on public.tenant_invitations for select to authenticated
using (public.is_tenant_owner(tenant_id));

create policy tenant_invitations_insert_owner
on public.tenant_invitations for insert to authenticated
with check (
  public.is_tenant_owner(tenant_id) and invited_by = (select auth.uid())
);

create policy tenant_invitations_update_owner
on public.tenant_invitations for update to authenticated
using (public.is_tenant_owner(tenant_id))
with check (public.is_tenant_owner(tenant_id));

revoke all on table public.tenant_invitations from anon, authenticated;
grant select (id, tenant_id, email, role, invited_by, created_at, expires_at,
  accepted_at, revoked_at) on table public.tenant_invitations to authenticated;
grant insert (tenant_id, email, role, token_hash, invited_by)
  on table public.tenant_invitations to authenticated;
grant update (revoked_at) on table public.tenant_invitations to authenticated;

-- Accepting requires the signed-in, confirmed account to own the invited
-- address: the link alone is not enough.
create or replace function public.accept_tenant_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.tenant_invitations%rowtype;
  v_email text;
begin
  select lower(email) into v_email
  from auth.users
  where id = (select auth.uid()) and email_confirmed_at is not null;

  if v_email is null then
    return null;
  end if;

  select * into v_invitation
  from public.tenant_invitations
  where token_hash = p_token_hash
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found or v_invitation.email <> v_email then
    return null;
  end if;

  insert into public.tenant_memberships (tenant_id, user_id, role)
  values (v_invitation.tenant_id, (select auth.uid()), v_invitation.role)
  on conflict (tenant_id, user_id) do nothing;

  update public.tenant_invitations
  set accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.tenant_id;
end;
$$;

revoke all on function public.accept_tenant_invitation(text)
  from public, anon;
grant execute on function public.accept_tenant_invitation(text)
  to authenticated;

-- 5. Members -------------------------------------------------------------
create or replace function public.list_tenant_members(p_tenant_id uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.tenant_memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant_id
    and public.is_tenant_member(p_tenant_id)
  order by (m.role = 'owner') desc, m.created_at;
$$;

create or replace function public.list_my_tenants()
returns table (tenant_id uuid, role text, owner_email text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.tenant_id, m.role, o_user.email::text
  from public.tenant_memberships m
  left join public.tenant_memberships o
    on o.tenant_id = m.tenant_id and o.role = 'owner'
  left join auth.users o_user on o_user.id = o.user_id
  where m.user_id = (select auth.uid())
  order by m.created_at;
$$;

create or replace function public.set_member_role(
  p_tenant_id uuid,
  p_user_id uuid,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_role not in ('member', 'viewer') then
    raise exception 'invalid role' using errcode = '22023';
  end if;

  if not public.is_tenant_owner(p_tenant_id) then
    raise exception 'owner only' using errcode = '42501';
  end if;

  update public.tenant_memberships
  set role = p_role
  where tenant_id = p_tenant_id
    and user_id = p_user_id
    and role <> 'owner';

  return found;
end;
$$;

-- The owner removes anyone but themselves; any non-owner can leave.
create or replace function public.remove_tenant_member(
  p_tenant_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_tenant_owner(p_tenant_id)
    or p_user_id = (select auth.uid())
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  delete from public.tenant_memberships
  where tenant_id = p_tenant_id
    and user_id = p_user_id
    and role <> 'owner';

  return found;
end;
$$;

revoke all on function public.list_tenant_members(uuid) from public, anon;
revoke all on function public.list_my_tenants() from public, anon;
revoke all on function public.set_member_role(uuid, uuid, text)
  from public, anon;
revoke all on function public.remove_tenant_member(uuid, uuid)
  from public, anon;
grant execute on function public.list_tenant_members(uuid) to authenticated;
grant execute on function public.list_my_tenants() to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text)
  to authenticated;
grant execute on function public.remove_tenant_member(uuid, uuid)
  to authenticated;
