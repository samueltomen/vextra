import { describe, expect, it } from 'vitest'

import { rotateMonitorTokenResponseSchema } from './rotate-token.ts'

describe('rotate monitor token response', () => {
  it('contains only the one-time heartbeat token', () => {
    expect(
      rotateMonitorTokenResponseSchema.parse({
        data: { heartbeatToken: 'new-raw-token' },
      }),
    ).toEqual({ data: { heartbeatToken: 'new-raw-token' } })
  })

  it('rejects token hashes and additional secret information', () => {
    expect(
      rotateMonitorTokenResponseSchema.safeParse({
        data: {
          heartbeatToken: 'new-raw-token',
          heartbeatTokenHash: 'a'.repeat(64),
        },
      }).success,
    ).toBe(false)
  })
})
