import { describe, expect, it, vi } from 'vitest'

import { SupabaseDueMonitorClaimer } from './supabase-due-monitor-claimer.ts'

describe('SupabaseDueMonitorClaimer', () => {
  it('claims a bounded due batch through the service RPC', async () => {
    const rpc = vi.fn(async () => ({ data: 4, error: null }))
    const claimer = new SupabaseDueMonitorClaimer({ rpc })

    await expect(claimer.claimDue(50)).resolves.toBe(4)
    expect(rpc).toHaveBeenCalledWith('open_due_monitor_incidents', {
      p_batch_size: 50,
    })
  })

  it('rejects malformed and failed RPC responses', async () => {
    const malformed = new SupabaseDueMonitorClaimer({
      rpc: async () => ({ data: null, error: null }),
    })
    await expect(malformed.claimDue(10)).rejects.toThrow(
      'due monitor check failed',
    )

    const failed = new SupabaseDueMonitorClaimer({
      rpc: async () => ({
        data: null,
        error: { message: 'service role denied' },
      }),
    })
    await expect(failed.claimDue(10)).rejects.toThrow(
      'due monitor check failed',
    )
  })
})
