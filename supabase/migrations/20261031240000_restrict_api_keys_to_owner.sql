-- Forward-only migration. Production rollback requires a new migration.
-- Found by the pre-production audit: an API key belongs to the space, not to
-- the person who created it, so a member who later leaves would keep read
-- access through a key they created. Only the owner can create or revoke keys.

alter policy api_keys_insert_member on public.api_keys
  with check (public.is_tenant_owner(tenant_id));

alter policy api_keys_update_member on public.api_keys
  using (public.is_tenant_owner(tenant_id))
  with check (public.is_tenant_owner(tenant_id));

alter policy api_keys_insert_member on public.api_keys
  rename to api_keys_insert_owner;

alter policy api_keys_update_member on public.api_keys
  rename to api_keys_update_owner;

-- Keys created by a member before this migration stay valid until the owner
-- revokes them from the settings; they remain visible to every member.
