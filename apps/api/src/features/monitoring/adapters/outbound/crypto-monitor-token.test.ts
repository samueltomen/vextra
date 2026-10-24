import { describe, expect, it } from 'vitest'

import {
  WebCryptoMonitorTokenGenerator,
  hashMonitorToken,
} from './crypto-monitor-token.ts'

const PEPPER = 'test-pepper-with-at-least-thirty-two-bytes'

describe('WebCryptoMonitorTokenGenerator', () => {
  it('creates an unguessable URL-safe token and its one-way hash', async () => {
    const generator = new WebCryptoMonitorTokenGenerator(PEPPER)
    const credential = await generator.generate()

    expect(credential.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(credential.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(credential.hash).toBe(
      await hashMonitorToken(credential.token, PEPPER),
    )
    expect(credential.prefix).toBe(credential.token.slice(0, 8))
    expect(credential.hash).not.toContain(credential.token)
  })

  it('generates a different token for each monitor', async () => {
    const generator = new WebCryptoMonitorTokenGenerator(PEPPER)

    const first = await generator.generate()
    const second = await generator.generate()

    expect(first.token).not.toBe(second.token)
    expect(first.hash).not.toBe(second.hash)
  })

  it('rejects a pepper shorter than 32 bytes', () => {
    expect(() => new WebCryptoMonitorTokenGenerator('too-short')).toThrow(
      RangeError,
    )
  })
})
