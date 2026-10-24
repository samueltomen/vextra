import { describe, expect, it, vi } from 'vitest'

import { SupabaseMonitorTokenRotation } from './supabase-monitor-token-rotation.ts'

const INPUT = {
  monitorId: '20000000-0000-4000-8000-000000000001',
  tokenHash: 'a'.repeat(64),
  tokenPrefix: 'abcdefgh',
}

describe('SupabaseMonitorTokenRotation', () => {
  it('sends only the new hash and prefix through the rotation RPC', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }))
    const rotation = new SupabaseMonitorTokenRotation({ rpc })

    await expect(rotation.rotate(INPUT)).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('rotate_monitor_token', {
      p_monitor_id: INPUT.monitorId,
      p_token_hash: INPUT.tokenHash,
      p_token_prefix: INPUT.tokenPrefix,
    })
  })

  it('rejects absent monitors and provider failures', async () => {
    const missing = new SupabaseMonitorTokenRotation({
      rpc: async () => ({ data: false, error: null }),
    })
    await expect(missing.rotate(INPUT)).resolves.toBe(false)

    const failed = new SupabaseMonitorTokenRotation({
      rpc: async () => ({
        data: null,
        error: { message: 'permission denied' },
      }),
    })
    await expect(failed.rotate(INPUT)).rejects.toThrow(
      'monitor token rotation failed',
    )
  })
})
