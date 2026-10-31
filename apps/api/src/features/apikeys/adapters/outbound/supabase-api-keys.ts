import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApiKeyView } from '@vextra/contracts'

import {
  ApiKeyLimitError,
  type ApiKeyAuthenticatorPort,
  type ApiKeyStorePort,
} from '../../application/api-keys.ts'

type Row = Readonly<{
  created_at: string
  id: string
  key_prefix: string
  last_used_at: string | null
  name: string
  revoked_at: string | null
}>

const COLUMNS = 'id, name, key_prefix, created_at, last_used_at, revoked_at'

function iso(value: string | null): string | null {
  return value === null ? null : new Date(value).toISOString()
}

function toView(row: Row): ApiKeyView {
  return {
    createdAt: new Date(row.created_at).toISOString(),
    id: row.id,
    lastUsedAt: iso(row.last_used_at),
    name: row.name,
    prefix: row.key_prefix,
    revokedAt: iso(row.revoked_at),
  }
}

/** Runs under the signed-in user's RLS; the hash column is write-only. */
export class SupabaseApiKeyStore implements ApiKeyStorePort {
  constructor(private readonly client: SupabaseClient) {}

  async list(tenantId: string): Promise<readonly ApiKeyView[]> {
    const { data, error } = await this.client
      .from('api_keys')
      .select(COLUMNS)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error('api key query failed')
    }

    return ((data ?? []) as readonly Row[]).map(toView)
  }

  async insert(
    tenantId: string,
    input: Readonly<{ hash: string; name: string; prefix: string }>,
  ): Promise<ApiKeyView> {
    const { data, error } = await this.client
      .from('api_keys')
      .insert({
        key_hash: input.hash,
        key_prefix: input.prefix,
        name: input.name,
        tenant_id: tenantId,
      })
      .select(COLUMNS)
      .single()

    if (error || !data) {
      if (error?.code === '54000') {
        throw new ApiKeyLimitError()
      }

      throw new Error('api key creation failed')
    }

    return toView(data as Row)
  }

  async revoke(tenantId: string, keyId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', keyId)
      .is('revoked_at', null)
      .select('id')

    if (error) {
      throw new Error('api key revocation failed')
    }

    return (data ?? []).length > 0
  }
}

/** Service role only: the SQL function is not granted to client roles. */
export class SupabaseApiKeyAuthenticator implements ApiKeyAuthenticatorPort {
  constructor(private readonly serviceClient: SupabaseClient) {}

  async authenticate(hash: string): Promise<string | null> {
    const { data, error } = await this.serviceClient.rpc(
      'authenticate_api_key',
      { p_key_hash: hash },
    )

    if (error) {
      throw new Error('api key authentication failed')
    }

    return typeof data === 'string' ? data : null
  }
}
