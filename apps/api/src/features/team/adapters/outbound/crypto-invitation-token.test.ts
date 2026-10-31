import { describe, expect, it } from 'vitest'

import { CryptoInvitationToken } from './crypto-invitation-token.ts'

describe('CryptoInvitationToken', () => {
  it('generates distinct vxi_ tokens with a reproducible keyed hash', async () => {
    const tokens = new CryptoInvitationToken('p'.repeat(32))
    const first = await tokens.generate()
    const second = await tokens.generate()

    expect(first.token).toMatch(/^vxi_[A-Za-z0-9_-]{43}$/)
    expect(first.token).not.toBe(second.token)
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/)
    await expect(tokens.hash(first.token)).resolves.toBe(first.hash)
  })
})
