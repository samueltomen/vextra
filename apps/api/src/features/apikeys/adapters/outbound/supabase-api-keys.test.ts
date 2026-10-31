import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { ApiKeyLimitError } from '../../application/api-keys.ts'
import {
  SupabaseApiKeyAuthenticator,
  SupabaseApiKeyStore,
} from './supabase-api-keys.ts'

const ROW = {
  created_at: '2026-10-31T12:00:00+00:00',
  id: 'k1',
  key_prefix: 'vx_abcdef1',
  last_used_at: null,
  name: 'CI',
  revoked_at: null,
}

function client(result: object) {
  const calls: [string, unknown[]][] = []
  const builder: Record<string, unknown> = {}

  for (const method of [
    'select',
    'eq',
    'is',
    'order',
    'insert',
    'update',
  ] as const) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args])

      return builder
    }
  }
  builder.single = async () => result
  builder.then = (resolve: (value: unknown) => void) => resolve(result)

  return {
    calls,
    supabase: { from: vi.fn(() => builder) } as unknown as SupabaseClient,
  }
}

describe('SupabaseApiKeyStore', () => {
  it('lists the keys of the tenant without any secret', async () => {
    const { calls, supabase } = client({ data: [ROW], error: null })
    const keys = await new SupabaseApiKeyStore(supabase).list('t1')

    expect(keys).toEqual([
      {
        createdAt: '2026-10-31T12:00:00.000Z',
        id: 'k1',
        lastUsedAt: null,
        name: 'CI',
        prefix: 'vx_abcdef1',
        revokedAt: null,
      },
    ])
    expect(calls).toContainEqual(['eq', ['tenant_id', 't1']])
    expect(JSON.stringify(calls)).not.toContain('key_hash,')
  })

  it('inserts the hash for the tenant and maps the limit error', async () => {
    const ok = client({ data: ROW, error: null })

    await new SupabaseApiKeyStore(ok.supabase).insert('t1', {
      hash: 'h',
      name: 'CI',
      prefix: 'vx_abcdef1',
    })
    expect(ok.calls).toContainEqual([
      'insert',
      [
        {
          key_hash: 'h',
          key_prefix: 'vx_abcdef1',
          name: 'CI',
          tenant_id: 't1',
        },
      ],
    ])

    const input = { hash: 'h', name: 'CI', prefix: 'vx_abcdef1' }
    const limit = new SupabaseApiKeyStore(
      client({ data: null, error: { code: '54000' } }).supabase,
    )
    const other = new SupabaseApiKeyStore(
      client({ data: null, error: { code: '42501' } }).supabase,
    )

    await expect(limit.insert('t1', input)).rejects.toBeInstanceOf(
      ApiKeyLimitError,
    )
    await expect(other.insert('t1', input)).rejects.toThrow(
      'api key creation failed',
    )
  })

  it('revokes an active key and fails closed on errors', async () => {
    const revoked = client({ data: [{ id: 'k1' }], error: null })

    await expect(
      new SupabaseApiKeyStore(revoked.supabase).revoke('t1', 'k1'),
    ).resolves.toBe(true)
    expect(revoked.calls).toContainEqual(['is', ['revoked_at', null]])
    await expect(
      new SupabaseApiKeyStore(
        client({ data: [], error: null }).supabase,
      ).revoke('t1', 'k1'),
    ).resolves.toBe(false)

    const failing = new SupabaseApiKeyStore(
      client({ data: null, error: { code: 'x' } }).supabase,
    )

    await expect(failing.list('t1')).rejects.toThrow('api key query failed')
    await expect(failing.revoke('t1', 'k1')).rejects.toThrow(
      'api key revocation failed',
    )
  })
})

describe('SupabaseApiKeyAuthenticator', () => {
  const authenticator = (data: unknown, error: object | null = null) =>
    new SupabaseApiKeyAuthenticator({
      rpc: async () => ({ data, error }),
    } as unknown as SupabaseClient)

  it('returns the tenant of a valid key, or null', async () => {
    await expect(authenticator('tenant-a').authenticate('h')).resolves.toBe(
      'tenant-a',
    )
    await expect(authenticator(null).authenticate('h')).resolves.toBeNull()
  })

  it('fails closed on provider errors', async () => {
    await expect(
      authenticator(null, { code: 'x' }).authenticate('h'),
    ).rejects.toThrow('api key authentication failed')
  })
})
