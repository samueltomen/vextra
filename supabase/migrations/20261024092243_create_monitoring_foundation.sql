-- Forward-only migration. Production rollback requires a new migration.

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.monitors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  heartbeat_token_hash text not null unique,
  heartbeat_token_prefix text not null
    check (char_length(heartbeat_token_prefix) between 6 and 12),
  interval_seconds integer not null
    check (interval_seconds between 60 and 31536000),
  grace_seconds integer not null
    check (grace_seconds between 0 and 604800),
  status text not null default 'pending'
    check (status in ('pending', 'healthy', 'late', 'paused')),
  last_heartbeat_at timestamptz,
  alert_at timestamptz not null,
  incident_opened_at timestamptz,
  paused_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index monitors_tenant_created_at_idx
  on public.monitors (tenant_id, created_at desc);

create index monitors_due_idx
  on public.monitors (alert_at)
  where enabled and status <> 'paused';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger monitors_set_updated_at
before update on public.monitors
for each row
execute function public.set_updated_at();

create or replace function public.is_tenant_member(target_tenant_id uuid)
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
  );
$$;

revoke all on function public.is_tenant_member(uuid) from public;
grant execute on function public.is_tenant_member(uuid) to authenticated;

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.monitors enable row level security;

create policy tenants_select_member
on public.tenants
for select
to authenticated
using (public.is_tenant_member(id));

create policy tenant_memberships_select_self
on public.tenant_memberships
for select
to authenticated
using (user_id = (select auth.uid()));

create policy monitors_select_member
on public.monitors
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy monitors_insert_member
on public.monitors
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy monitors_update_member
on public.monitors
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy monitors_delete_member
on public.monitors
for delete
to authenticated
using (public.is_tenant_member(tenant_id));

revoke all on table public.tenants from anon;
revoke all on table public.tenant_memberships from anon;
revoke all on table public.monitors from anon;

grant select on table public.tenants to authenticated;
grant select on table public.tenant_memberships to authenticated;
grant select, insert, delete on table public.monitors to authenticated;
grant update (
  status,
  last_heartbeat_at,
  alert_at,
  incident_opened_at,
  paused_at,
  enabled,
  updated_at
) on table public.monitors to authenticated;

comment on table public.tenants is
  'Opaque tenant boundary; no user-provided label is stored.';
comment on table public.monitors is
  'Minimal monitor state only. No script, cron, command, log, IP or payload.';
comment on column public.monitors.heartbeat_token_hash is
  'HMAC-SHA-256 of the heartbeat token. The raw token is never stored.';
