import { describe, expect, it, vi } from 'vitest'

import {
  AccountCreationError,
  AccountService,
  InvalidCredentialsError,
  type AccountsGateway,
  type SessionTokens,
} from './account-service.ts'

const USER = {
  email: 'alice@example.test',
  id: '00000000-0000-4000-8000-000000000001',
}
const TENANT_ID = '10000000-0000-4000-8000-000000000001'
const NOW_MS = Date.parse('2026-10-24T10:00:00.000Z')
const TOKENS: SessionTokens = {
  accessToken: 'access-token',
  expiresAtMs: NOW_MS + 3_600_000,
  refreshToken: 'refresh-token',
}

function createGateway(
  overrides: Partial<AccountsGateway> = {},
): AccountsGateway {
  return {
    getUser: vi.fn(async () => USER),
    refreshSession: vi.fn(async () => ({ session: TOKENS, user: USER })),
    resolvePrimaryTenantId: vi.fn(async () => ({
      role: 'owner' as const,
      tenantId: TENANT_ID,
    })),
    revokeSession: vi.fn(async () => undefined),
    signIn: vi.fn(async () => ({ session: TOKENS, user: USER })),
    signUp: vi.fn(async () => ({ session: TOKENS, user: USER })),
    ...overrides,
  }
}

function createService(gateway: AccountsGateway) {
  return new AccountService({
    clock: { nowMs: () => NOW_MS },
    gateway,
  })
}

describe('AccountService', () => {
  it('creates an authenticated session scoped to the primary tenant', async () => {
    const gateway = createGateway()
    const service = createService(gateway)

    await expect(
      service.signIn({
        email: 'alice@example.test',
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual({
      refreshed: false,
      role: 'owner',
      tenantId: TENANT_ID,
      tokens: { ...TOKENS, tenantId: TENANT_ID },
      user: USER,
    })
    expect(gateway.resolvePrimaryTenantId).toHaveBeenCalledWith({
      accessToken: TOKENS.accessToken,
      preferredTenantId: undefined,
      userId: USER.id,
    })
  })

  it('asks the gateway for the space stored in the session and keeps it on refresh', async () => {
    const other = '10000000-0000-4000-8000-000000000002'
    const gateway = createGateway({
      resolvePrimaryTenantId: vi.fn(async () => ({
        role: 'viewer' as const,
        tenantId: other,
      })),
    })
    const service = createService(gateway)

    await expect(
      service.authenticate({ ...TOKENS, tenantId: other }),
    ).resolves.toMatchObject({ role: 'viewer', tenantId: other })
    expect(gateway.resolvePrimaryTenantId).toHaveBeenCalledWith(
      expect.objectContaining({ preferredTenantId: other }),
    )

    const expired = { ...TOKENS, expiresAtMs: NOW_MS, tenantId: other }

    await expect(service.authenticate(expired)).resolves.toMatchObject({
      refreshed: true,
      tokens: expect.objectContaining({ tenantId: other }),
    })
  })

  it('returns a confirmation state without requiring a tenant when signup has no session', async () => {
    const gateway = createGateway({
      signUp: vi.fn(async () => ({ session: null, user: USER })),
    })
    const service = createService(gateway)

    await expect(
      service.signUp({
        email: USER.email,
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual({
      requiresEmailConfirmation: true,
      user: USER,
    })
    expect(gateway.resolvePrimaryTenantId).not.toHaveBeenCalled()
  })

  it('returns an authenticated session when signup immediately succeeds', async () => {
    const service = createService(createGateway())

    await expect(
      service.signUp({
        email: USER.email,
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual({
      requiresEmailConfirmation: false,
      session: {
        refreshed: false,
        role: 'owner',
        tenantId: TENANT_ID,
        tokens: { ...TOKENS, tenantId: TENANT_ID },
        user: USER,
      },
      user: USER,
    })
  })

  it('refreshes an access token that is close to expiration', async () => {
    const refreshedTokens: SessionTokens = {
      accessToken: 'fresh-access-token',
      expiresAtMs: NOW_MS + 7_200_000,
      refreshToken: 'fresh-refresh-token',
    }
    const gateway = createGateway({
      refreshSession: vi.fn(async () => ({
        session: refreshedTokens,
        user: USER,
      })),
    })
    const service = createService(gateway)

    await expect(
      service.authenticate({
        ...TOKENS,
        expiresAtMs: NOW_MS + 30_000,
      }),
    ).resolves.toEqual({
      refreshed: true,
      role: 'owner',
      tenantId: TENANT_ID,
      tokens: { ...refreshedTokens, tenantId: TENANT_ID },
      user: USER,
    })
    expect(gateway.getUser).not.toHaveBeenCalled()
  })

  it('authenticates a current access token without refreshing it', async () => {
    const gateway = createGateway()
    const service = createService(gateway)

    await expect(service.authenticate(TOKENS)).resolves.toEqual({
      refreshed: false,
      role: 'owner',
      tenantId: TENANT_ID,
      tokens: { ...TOKENS, tenantId: TENANT_ID },
      user: USER,
    })
    expect(gateway.getUser).toHaveBeenCalledWith(TOKENS.accessToken)
    expect(gateway.refreshSession).not.toHaveBeenCalled()
  })

  it('refreshes once when a non-expired access token is rejected', async () => {
    const getUser = vi
      .fn<AccountsGateway['getUser']>()
      .mockRejectedValueOnce(new Error('revoked'))
    const service = createService(createGateway({ getUser }))

    await expect(service.authenticate(TOKENS)).resolves.toMatchObject({
      refreshed: true,
      tokens: TOKENS,
    })
  })

  it('fails closed when neither the access nor refresh token is valid', async () => {
    const service = createService(
      createGateway({
        getUser: vi.fn(async () => {
          throw new Error('invalid token')
        }),
        refreshSession: vi.fn(async () => {
          throw new Error('revoked refresh token')
        }),
      }),
    )

    await expect(service.authenticate(TOKENS)).resolves.toBeNull()
  })

  it('fails closed when a valid identity has no tenant membership', async () => {
    const service = createService(
      createGateway({
        resolvePrimaryTenantId: vi.fn(async () => null),
      }),
    )

    await expect(service.authenticate(TOKENS)).resolves.toBeNull()
  })

  it('maps provider credential failures to a stable authentication error', async () => {
    const service = createService(
      createGateway({
        signIn: vi.fn(async () => {
          throw new Error('provider detail')
        }),
      }),
    )

    await expect(
      service.signIn({ email: USER.email, password: 'wrong password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('fails safely when signup succeeds without creating a tenant', async () => {
    const service = createService(
      createGateway({
        resolvePrimaryTenantId: vi.fn(async () => null),
      }),
    )

    await expect(
      service.signUp({
        email: USER.email,
        password: 'correct horse battery staple',
      }),
    ).rejects.toBeInstanceOf(AccountCreationError)
  })

  it('always clears the local session even when remote revocation fails', async () => {
    const gateway = createGateway({
      revokeSession: vi.fn(async () => {
        throw new Error('provider unavailable')
      }),
    })
    const service = createService(gateway)

    await expect(service.revoke(TOKENS)).resolves.toBeUndefined()
  })
})
