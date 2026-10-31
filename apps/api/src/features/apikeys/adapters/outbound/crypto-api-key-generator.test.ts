import { describe, expect, it } from 'vitest'

import { CryptoApiKeyGenerator } from './crypto-api-key-generator.ts'

const PEPPER = 'p'.repeat(32)

describe('CryptoApiKeyGenerator', () => {
  it('generates distinct vx_ keys whose hash is reproducible', async () => {
    const generator = new CryptoApiKeyGenerator(PEPPER)
    const first = await generator.generate()
    const second = await generator.generate()

    expect(first.key).toMatch(/^vx_[A-Za-z0-9_-]{43}$/)
    expect(first.key).not.toBe(second.key)
    expect(first.prefix).toBe(first.key.slice(0, 10))
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/)
    await expect(generator.hash(first.key)).resolves.toBe(first.hash)
  })

  it('depends on the pepper', async () => {
    const key = `vx_${'A'.repeat(43)}`

    expect(await new CryptoApiKeyGenerator(PEPPER).hash(key)).not.toBe(
      await new CryptoApiKeyGenerator('q'.repeat(32)).hash(key),
    )
  })
})
