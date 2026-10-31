import { describe, expect, it, vi } from 'vitest'

import {
  AuthenticateApiKey,
  ManageApiKeys,
  type ApiKeyGeneratorPort,
} from './api-keys.ts'

const VALID_KEY = `vx_${'A'.repeat(43)}`

function generator(): ApiKeyGeneratorPort {
  return {
    generate: vi.fn(async () => ({
      hash: 'h'.repeat(64),
      key: VALID_KEY,
      prefix: VALID_KEY.slice(0, 10),
    })),
    hash: vi.fn(async (key: string) => `hash-of-${key}`),
  }
}

describe('ManageApiKeys', () => {
  it('stores only the hash and returns the secret once', async () => {
    const insert = vi.fn(async () => ({ id: 'k1' }) as never)
    const useCase = new ManageApiKeys({
      generator: generator(),
      store: { insert, list: vi.fn(), revoke: vi.fn() },
    })

    const result = await useCase.create('t1', 'CI')

    expect(result.key).toBe(VALID_KEY)
    expect(insert).toHaveBeenCalledWith('t1', {
      hash: 'h'.repeat(64),
      name: 'CI',
      prefix: 'vx_AAAAAAA',
    })
    expect(JSON.stringify(insert.mock.calls)).not.toContain(VALID_KEY)
  })

  it('delegates listing and revocation to the store with the tenant', async () => {
    const store = {
      insert: vi.fn(),
      list: vi.fn(async () => []),
      revoke: vi.fn(async () => true),
    }
    const useCase = new ManageApiKeys({ generator: generator(), store })

    await useCase.list('t1')
    await useCase.revoke('t1', 'k1')
    expect(store.list).toHaveBeenCalledWith('t1')
    expect(store.revoke).toHaveBeenCalledWith('t1', 'k1')
  })
})

describe('AuthenticateApiKey', () => {
  it('resolves a well-formed key through its hash', async () => {
    const authenticate = vi.fn(async () => 'tenant-a')
    const useCase = new AuthenticateApiKey({
      authenticator: { authenticate },
      generator: generator(),
    })

    await expect(useCase.tenantFor(VALID_KEY)).resolves.toBe('tenant-a')
    expect(authenticate).toHaveBeenCalledWith(`hash-of-${VALID_KEY}`)
  })

  it('rejects malformed keys without touching the database', async () => {
    const authenticate = vi.fn(async () => 'tenant-a')
    const useCase = new AuthenticateApiKey({
      authenticator: { authenticate },
      generator: generator(),
    })

    for (const key of [
      '',
      'vx_short',
      `xx_${'A'.repeat(43)}`,
      `vx_${'!'.repeat(43)}`,
    ]) {
      await expect(useCase.tenantFor(key)).resolves.toBeNull()
    }

    expect(authenticate).not.toHaveBeenCalled()
  })
})
