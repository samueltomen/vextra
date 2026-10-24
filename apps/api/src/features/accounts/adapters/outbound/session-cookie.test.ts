import { describe, expect, it } from 'vitest'

import { SessionCookieCodec } from './session-cookie.ts'

const SECRET = 'session-secret-with-at-least-32-bytes-of-entropy'

describe('SessionCookieCodec', () => {
  it('encrypts and decrypts a Supabase session', async () => {
    const codec = new SessionCookieCodec(SECRET)
    const payload = {
      accessToken: 'access-token',
      expiresAtMs: 1_800_000_000_000,
      refreshToken: 'refresh-token',
    }

    const encoded = await codec.encode(payload)

    expect(encoded).not.toContain(payload.accessToken)
    expect(encoded).not.toContain(payload.refreshToken)
    await expect(codec.decode(encoded)).resolves.toEqual(payload)
  })

  it('rejects a tampered cookie', async () => {
    const codec = new SessionCookieCodec(SECRET)
    const encoded = await codec.encode({
      accessToken: 'access-token',
      expiresAtMs: 1_800_000_000_000,
      refreshToken: 'refresh-token',
    })
    const tampered = `${encoded.slice(0, -2)}aa`

    await expect(codec.decode(tampered)).resolves.toBeNull()
  })

  it('rejects malformed input and short secrets', async () => {
    const codec = new SessionCookieCodec(SECRET)

    await expect(codec.decode('not-a-cookie')).resolves.toBeNull()
    expect(() => new SessionCookieCodec('too-short')).toThrow(RangeError)
  })
})
