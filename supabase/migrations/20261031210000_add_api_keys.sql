-- Forward-only migration. Production rollback requires a new migration.
-- Read-only API keys: a key authenticates a script as its tenant. Only a keyed
-- hash is stored; the secret is shown once at creation.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  key_prefix text not null check (char_length(key_prefix) = 10),
  key_hash text not null unique check (key_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index api_keys_tenant_idx on public.api_keys (tenant_id, created_at desc);

create or replace function public.enforce_api_key_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from public.api_keys
    where tenant_id = new.tenant_id and revoked_at is null
  ) >= 10 then
    raise exception 'api key limit reached'
      using errcode = '54000';
  end if;

  return new;
end;
$$;

create trigger api_keys_limit
before insert on public.api_keys
for each row
execute function public.enforce_api_key_limit();

alter table public.api_keys enable row level security;

create policy api_keys_select_member
on public.api_keys for select to authenticated
using (public.is_tenant_member(tenant_id));

create policy api_keys_insert_member
on public.api_keys for insert to authenticated
with check (public.is_tenant_member(tenant_id));

create policy api_keys_update_member
on public.api_keys for update to authenticated
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

revoke all on table public.api_keys from anon, authenticated;
-- The hash is never readable by clients: it can only be written once.
grant select (id, tenant_id, name, key_prefix, created_at, last_used_at, revoked_at)
  on table public.api_keys to authenticated;
grant insert (tenant_id, name, key_prefix, key_hash)
  on table public.api_keys to authenticated;
grant update (revoked_at) on table public.api_keys to authenticated;

-- Service role only: resolves a key hash to its tenant and records usage
-- (at most once a minute, to keep the hot path free of writes).
create or replace function public.authenticate_api_key(p_key_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys%rowtype;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then
    return null;
  end if;

  select * into v_key
  from public.api_keys
  where key_hash = p_key_hash and revoked_at is null;

  if not found then
    return null;
  end if;

  if v_key.last_used_at is null
    or v_key.last_used_at < now() - interval '1 minute' then
    update public.api_keys set last_used_at = now() where id = v_key.id;
  end if;

  return v_key.tenant_id;
end;
$$;

revoke all on function public.authenticate_api_key(text)
  from public, anon, authenticated;
grant execute on function public.authenticate_api_key(text) to service_role;

comment on table public.api_keys is
  'Read-only API keys. key_hash is a keyed hash; the secret is never stored.';
