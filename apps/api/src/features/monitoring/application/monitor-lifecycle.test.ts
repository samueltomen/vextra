import { describe, expect, it, vi } from 'vitest'

import {
  MonitorLifecycle,
  type MonitorLifecyclePort,
} from './monitor-lifecycle.ts'

function createPort(
  overrides: Partial<MonitorLifecyclePort> = {},
): MonitorLifecyclePort {
  return {
    delete: vi.fn(async () => true),
    pause: vi.fn(async () => true),
    resume: vi.fn(async () => true),
    ...overrides,
  }
}

describe('MonitorLifecycle', () => {
  it('delegates pause, resume and delete with an explicit monitor id', async () => {
    const port = createPort()
    const lifecycle = new MonitorLifecycle(port)
    const monitorId = '20000000-0000-4000-8000-000000000001'

    await expect(lifecycle.pause(monitorId)).resolves.toBe(true)
    await expect(lifecycle.resume(monitorId)).resolves.toBe(true)
    await expect(lifecycle.delete(monitorId)).resolves.toBe(true)
    expect(port.pause).toHaveBeenCalledWith(monitorId)
    expect(port.resume).toHaveBeenCalledWith(monitorId)
    expect(port.delete).toHaveBeenCalledWith(monitorId)
  })

  it('propagates infrastructure failures without replacing the result', async () => {
    const lifecycle = new MonitorLifecycle(
      createPort({
        pause: async () => {
          throw new Error('database unavailable')
        },
      }),
    )

    await expect(
      lifecycle.pause('20000000-0000-4000-8000-000000000001'),
    ).rejects.toThrow('database unavailable')
  })
})
