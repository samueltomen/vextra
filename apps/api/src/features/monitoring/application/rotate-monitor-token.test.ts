import { describe, expect, it, vi } from 'vitest'

import {
  RotateMonitorToken,
  type MonitorTokenRotationPort,
} from './rotate-monitor-token.ts'

describe('RotateMonitorToken', () => {
  it('stores only the new hash and prefix and returns the raw token once', async () => {
    const port: MonitorTokenRotationPort = {
      rotate: vi.fn(async () => true),
    }
    const generator = {
      generate: vi.fn(async () => ({
        hash: 'a'.repeat(64),
        prefix: 'abcdefgh',
        token: 'A'.repeat(43),
      })),
    }
    const rotate = new RotateMonitorToken({ generator, port })

    await expect(
      rotate.execute('20000000-0000-4000-8000-000000000001'),
    ).resolves.toBe('A'.repeat(43))
    expect(port.rotate).toHaveBeenCalledWith({
      monitorId: '20000000-0000-4000-8000-000000000001',
      tokenHash: 'a'.repeat(64),
      tokenPrefix: 'abcdefgh',
    })
    expect(JSON.stringify(vi.mocked(port.rotate).mock.calls)).not.toContain(
      'A'.repeat(43),
    )
  })

  it('returns null when the monitor is absent from the tenant', async () => {
    const rotate = new RotateMonitorToken({
      generator: {
        generate: async () => ({
          hash: 'b'.repeat(64),
          prefix: 'ijklmnop',
          token: 'B'.repeat(43),
        }),
      },
      port: { rotate: async () => false },
    })

    await expect(
      rotate.execute('20000000-0000-4000-8000-000000000001'),
    ).resolves.toBeNull()
  })
})
