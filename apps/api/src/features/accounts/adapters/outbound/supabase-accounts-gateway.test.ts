import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  AccountCreationError,
  InvalidCredentialsError,
  type SessionTokens,
} from '../../application/account-service.ts'
import { SupabaseAccountsGateway } from './supabase-accounts-gateway.ts'

const USER = {
  email: 'alice@example.test',
  id: '00000000-0000-4000-8000-000000000001',
}
const SESSION = {
  access_token: 'access-token',
  expires_at: 1_800_000_000,
  refresh_token: 'refresh-token',
}

function createClient(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      admin: {
        signOut: vi.fn(async () => ({ data: null, error: null })),
      },
      getUser: vi.fn(async () => ({ data: { user: USER }, error: null })),
      refreshSession: vi.fn(async () => ({
        data: { session: SESSION, user: USER },
        error: null,
      })),
      signInWithPassword: vi.fn(async () => ({
        data: { session: SESSION, user: USER },
        error: null,
      })),
      signUp: vi.fn(async () => ({
        data: { session: SESSION, user: USER },
        error: null,
      })),
      ...overrides,
    },
  } as unknown as SupabaseClient
}

describe('SupabaseAccountsGateway', () => {
  it('creates a session without exposing provider tokens to the application contract', async () => {
    const client = createClient()
    const gateway = new SupabaseAccountsGateway(client, () => client)

    await expect(
      gateway.signIn({
        email: USER.email,
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual({
      session: {
        accessToken: SESSION.access_token,
        expiresAtMs: SESSION.expires_at * 1000,
        refreshToken: SESSION.refresh_token,
      } satisfies SessionTokens,
      user: USER,
    })
  })

  it('normalizes sign-in failures without leaking provider details', async () => {
    const client = createClient({
      signInWithPassword: vi.fn(async () => ({
        data: { session: null, user: null },
        error: { message: 'User not found for alice@example.test' },
      })),
    })
    const gateway = new SupabaseAccountsGateway(client, () => client)

    await expect(
      gateway.signIn({
        email: USER.email,
        password: 'wrong password',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('normalizes signup failures and supports pending email confirmation', async () => {
    const rejectedClient = createClient({
      signUp: vi.fn(async () => ({
        data: { session: null, user: null },
        error: { message: 'User already exists' },
      })),
    })
    const rejectedGateway = new SupabaseAccountsGateway(
      rejectedClient,
      () => rejectedClient,
    )

    await expect(
      rejectedGateway.signUp({
        email: USER.email,
        password: 'correct horse battery staple',
      }),
    ).rejects.toBeInstanceOf(AccountCreationError)

    const pendingClient = createClient({
      signUp: vi.fn(async () => ({
        data: { session: null, user: USER },
        error: null,
      })),
    })
    const pendingGateway = new SupabaseAccountsGateway(
      pendingClient,
      () => pendingClient,
    )

    await expect(
      pendingGateway.signUp({
        email: USER.email,
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual({ session: null, user: USER })
  })

  it('rejects invalid or incomplete refreshed sessions', async () => {
    const errorClient = createClient({
      refreshSession: vi.fn(async () => ({
        data: { session: null, user: null },
        error: { message: 'Refresh token revoked' },
      })),
    })
    const errorGateway = new SupabaseAccountsGateway(
      errorClient,
      () => errorClient,
    )

    await expect(
      errorGateway.refreshSession('refresh-token'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)

    const incompleteClient = createClient({
      refreshSession: vi.fn(async () => ({
        data: {
          session: { access_token: 'access-token', refresh_token: 'refresh' },
          user: USER,
        },
        error: null,
      })),
    })
    const incompleteGateway = new SupabaseAccountsGateway(
      incompleteClient,
      () => incompleteClient,
    )

    await expect(
      incompleteGateway.refreshSession('refresh-token'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('resolves the primary tenant through a user-scoped client', async () => {
    const client = createClient()
    const maybeSingle = vi.fn(async () => ({
      data: { tenant_id: '10000000-0000-4000-8000-000000000001' },
      error: null,
    }))
    const limit = vi.fn(() => ({ maybeSingle }))
    const order = vi.fn(() => ({ limit }))
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select }))
    const userClient = { from } as unknown as SupabaseClient
    const createUserClient = vi.fn(() => userClient)
    const gateway = new SupabaseAccountsGateway(client, createUserClient)

    await expect(
      gateway.resolvePrimaryTenantId({
        accessToken: 'access-token',
        userId: USER.id,
      }),
    ).resolves.toBe('10000000-0000-4000-8000-000000000001')

    expect(createUserClient).toHaveBeenCalledWith('access-token')
    expect(from).toHaveBeenCalledWith('tenant_memberships')
    expect(select).toHaveBeenCalledWith('tenant_id')
    expect(eq).toHaveBeenCalledWith('user_id', USER.id)
  })

  it('revokes the current refresh session through the user access token', async () => {
    const client = createClient()
    const gateway = new SupabaseAccountsGateway(client, () => client)

    await gateway.revokeSession('access-token')

    expect(client.auth.admin.signOut).toHaveBeenCalledWith(
      'access-token',
      'local',
    )
  })

  it('returns null when tenant resolution is rejected or malformed', async () => {
    const client = createClient()
    const rejected = new SupabaseAccountsGateway(client, () => {
      const maybeSingle = vi.fn(async () => ({
        data: null,
        error: { message: 'row level security denied' },
      }))
      const limit = vi.fn(() => ({ maybeSingle }))
      const order = vi.fn(() => ({ limit }))
      const eq = vi.fn(() => ({ order }))
      const select = vi.fn(() => ({ eq }))

      return {
        from: () => ({ select }),
      } as unknown as SupabaseClient
    })

    await expect(
      rejected.resolvePrimaryTenantId({
        accessToken: 'access-token',
        userId: USER.id,
      }),
    ).resolves.toBeNull()

    const malformed = new SupabaseAccountsGateway(client, () => {
      const maybeSingle = vi.fn(async () => ({
        data: { tenant_id: 42 },
        error: null,
      }))
      const limit = vi.fn(() => ({ maybeSingle }))
      const order = vi.fn(() => ({ limit }))
      const eq = vi.fn(() => ({ order }))
      const select = vi.fn(() => ({ eq }))

      return {
        from: () => ({ select }),
      } as unknown as SupabaseClient
    })

    await expect(
      malformed.resolvePrimaryTenantId({
        accessToken: 'access-token',
        userId: USER.id,
      }),
    ).resolves.toBeNull()
  })

  it('rejects failed session revocation and rejected access tokens', async () => {
    const client = createClient()
    const revokeClient = {
      auth: {
        admin: {
          signOut: vi.fn(async () => ({
            data: null,
            error: { message: 'session revoked' },
          })),
        },
      },
    } as unknown as SupabaseClient
    const gateway = new SupabaseAccountsGateway(client, () => revokeClient)

    await expect(gateway.revokeSession('access-token')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    )

    const rejectedUserClient = createClient({
      getUser: vi.fn(async () => ({
        data: { user: null },
        error: { message: 'token expired' },
      })),
    })
    const rejectedUserGateway = new SupabaseAccountsGateway(
      rejectedUserClient,
      () => rejectedUserClient,
    )

    await expect(
      rejectedUserGateway.getUser('access-token'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('never returns a provider user without an email', async () => {
    const client = createClient({
      getUser: vi.fn(async () => ({
        data: { user: { id: USER.id } },
        error: null,
      })),
    })
    const gateway = new SupabaseAccountsGateway(client, () => client)

    await expect(gateway.getUser('access-token')).rejects.toThrow(
      'Authentication failed',
    )
  })
})
