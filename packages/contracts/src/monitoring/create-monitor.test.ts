import { describe, expect, it } from 'vitest'

import {
  createMonitorRequestSchema,
  createMonitorResponseSchema,
} from './create-monitor.ts'

describe('createMonitorRequestSchema', () => {
  it('accepts only the technical monitor configuration', () => {
    expect(
      createMonitorRequestSchema.parse({
        intervalSeconds: 300,
        graceSeconds: 30,
      }),
    ).toEqual({
      intervalSeconds: 300,
      graceSeconds: 30,
    })
  })

  it('rejects a tenant identifier supplied by the client', () => {
    const result = createMonitorRequestSchema.safeParse({
      tenantId: 'attacker-controlled',
      intervalSeconds: 300,
      graceSeconds: 30,
    })

    expect(result.success).toBe(false)
  })

  it('rejects invalid scheduling values', () => {
    expect(
      createMonitorRequestSchema.safeParse({
        intervalSeconds: 59,
        graceSeconds: 30,
      }).success,
    ).toBe(false)

    expect(
      createMonitorRequestSchema.safeParse({
        intervalSeconds: 300,
        graceSeconds: -1,
      }).success,
    ).toBe(false)
  })
})

describe('createMonitorResponseSchema', () => {
  it('returns the monitor with its one-time heartbeat token', () => {
    expect(
      createMonitorResponseSchema.parse({
        data: {
          id: 'monitor-1',
          intervalSeconds: 300,
          graceSeconds: 30,
          status: 'pending',
          alertAt: '2026-01-01T00:05:30.000Z',
          heartbeatToken: 'secret-token',
        },
      }),
    ).toEqual({
      data: {
        id: 'monitor-1',
        intervalSeconds: 300,
        graceSeconds: 30,
        status: 'pending',
        alertAt: '2026-01-01T00:05:30.000Z',
        heartbeatToken: 'secret-token',
      },
    })
  })
})
