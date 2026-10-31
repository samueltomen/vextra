-- Forward-only migration. Production rollback requires a new migration.

create table public.monitor_folders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index monitor_folders_tenant_id_id_uidx
  on public.monitor_folders (tenant_id, id);

create unique index monitor_folders_tenant_name_uidx
  on public.monitor_folders (tenant_id, lower(btrim(name)));

create trigger monitor_folders_set_updated_at
before update on public.monitor_folders
for each row
execute function public.set_updated_at();

create or replace function public.enforce_monitor_folder_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.monitor_folders
    where tenant_id = new.tenant_id
  ) >= 50 then
    raise exception 'folder limit reached'
      using errcode = '54000';
  end if;

  return new;
end;
$$;

create trigger monitor_folders_limit
before insert on public.monitor_folders
for each row
execute function public.enforce_monitor_folder_limit();

alter table public.monitors add column folder_id uuid;

alter table public.monitors
  add constraint monitors_folder_fk
  foreign key (tenant_id, folder_id)
  references public.monitor_folders (tenant_id, id)
  on delete set null (folder_id);

create index monitors_folder_idx
  on public.monitors (tenant_id, folder_id)
  where folder_id is not null;

alter table public.monitor_folders enable row level security;

create policy monitor_folders_select_member
on public.monitor_folders
for select
to authenticated
using (public.is_tenant_member(tenant_id));

create policy monitor_folders_insert_member
on public.monitor_folders
for insert
to authenticated
with check (public.is_tenant_member(tenant_id));

create policy monitor_folders_update_member
on public.monitor_folders
for update
to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

create policy monitor_folders_delete_member
on public.monitor_folders
for delete
to authenticated
using (public.is_tenant_member(tenant_id));

revoke all on table public.monitor_folders from anon;
grant select, insert, delete on table public.monitor_folders to authenticated;
grant update (name, updated_at) on table public.monitor_folders to authenticated;
grant update (folder_id) on table public.monitors to authenticated;

comment on table public.monitor_folders is
  'Flat, single-level organisation folders. Names are user labels; no secrets.';
comment on column public.monitors.folder_id is
  'Optional folder. Same-tenant is enforced by the composite foreign key.';
