import { describe, expect, it, vi } from 'vitest'

import { SupabaseMonitorLifecycle } from './supabase-monitor-lifecycle.ts'

describe('SupabaseMonitorLifecycle', () => {
  it('calls the dedicated RPC for each lifecycle action', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }))
    const lifecycle = new SupabaseMonitorLifecycle({ rpc })
    const monitorId = '20000000-0000-4000-8000-000000000001'

    await expect(lifecycle.pause(monitorId)).resolves.toBe(true)
    await expect(lifecycle.resume(monitorId)).resolves.toBe(true)
    await expect(lifecycle.delete(monitorId)).resolves.toBe(true)
    expect(rpc).toHaveBeenNthCalledWith(1, 'pause_monitor', {
      p_monitor_id: monitorId,
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'resume_monitor', {
      p_monitor_id: monitorId,
    })
    expect(rpc).toHaveBeenNthCalledWith(3, 'delete_monitor', {
      p_monitor_id: monitorId,
    })
  })

  it('returns false for a missing monitor and rejects provider failures', async () => {
    const missing = new SupabaseMonitorLifecycle({
      rpc: async () => ({ data: false, error: null }),
    })
    await expect(
      missing.pause('20000000-0000-4000-8000-000000000001'),
    ).resolves.toBe(false)

    const failed = new SupabaseMonitorLifecycle({
      rpc: async () => ({
        data: null,
        error: { message: 'permission denied' },
      }),
    })
    await expect(
      failed.delete('20000000-0000-4000-8000-000000000001'),
    ).rejects.toThrow('monitor lifecycle failed')
  })
})
