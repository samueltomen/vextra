begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email)
values
  ('da000000-0000-4000-8000-000000000001', 'keys-a@example.test'),
  ('da000000-0000-4000-8000-000000000002', 'keys-b@example.test');

select set_config('test.tenant_a',
  (select tenant_id::text from public.tenant_memberships
   where user_id = 'da000000-0000-4000-8000-000000000001'), true);
select set_config('test.tenant_b',
  (select tenant_id::text from public.tenant_memberships
   where user_id = 'da000000-0000-4000-8000-000000000002'), true);

set local role authenticated;
select set_config('request.jwt.claim.sub',
  'da000000-0000-4000-8000-000000000001', true);

select lives_ok(
  format($$insert into public.api_keys (tenant_id, name, key_prefix, key_hash)
    values (%L, 'CI', 'vx_abcdef1', repeat('a', 64))$$,
    current_setting('test.tenant_a')),
  'a member can create a key for their tenant'
);

select throws_ok(
  format($$insert into public.api_keys (tenant_id, name, key_prefix, key_hash)
    values (%L, 'Foreign', 'vx_abcdef2', repeat('b', 64))$$,
    current_setting('test.tenant_b')),
  '42501', null,
  'a member cannot create a key for another tenant'
);

select throws_ok(
  $$select key_hash from public.api_keys$$,
  '42501', null,
  'the key hash is not readable by clients'
);

select is(
  (select count(*)::integer from public.api_keys),
  1,
  'a member only sees the keys of their tenant'
);

select throws_ok(
  $$update public.api_keys set name = 'renamed'$$,
  '42501', null,
  'only the revocation can be updated'
);

reset role;

select is(
  public.authenticate_api_key(repeat('a', 64)),
  current_setting('test.tenant_a')::uuid,
  'a valid key resolves to its tenant'
);

select ok(
  (select last_used_at is not null from public.api_keys
   where key_hash = repeat('a', 64)),
  'usage is recorded'
);

select is(
  public.authenticate_api_key(repeat('c', 64)),
  null::uuid,
  'an unknown key resolves to nothing'
);

update public.api_keys set revoked_at = now() where key_hash = repeat('a', 64);

select is(
  public.authenticate_api_key(repeat('a', 64)),
  null::uuid,
  'a revoked key no longer authenticates'
);

set local role anon;

select throws_ok(
  $$select public.authenticate_api_key(repeat('a', 64))$$,
  '42501', null,
  'clients cannot call the authentication function'
);

select * from finish();

rollback;
