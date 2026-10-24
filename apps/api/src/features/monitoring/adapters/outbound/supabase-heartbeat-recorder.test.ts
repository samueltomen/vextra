import { describe, expect, it, vi } from 'vitest'

import { SupabaseHeartbeatRecorder } from './supabase-heartbeat-recorder.ts'

describe('SupabaseHeartbeatRecorder', () => {
  it('records only the token hash through the dedicated RPC', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }))
    const recorder = new SupabaseHeartbeatRecorder({ rpc })
    const tokenHash = 'a'.repeat(64)

    await expect(recorder.record(tokenHash)).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('record_heartbeat', {
      p_token_hash: tokenHash,
    })
  })

  it('returns false for unmatched hashes and rejects provider failures', async () => {
    const unmatched = new SupabaseHeartbeatRecorder({
      rpc: async () => ({ data: false, error: null }),
    })
    await expect(unmatched.record('b'.repeat(64))).resolves.toBe(false)

    const failed = new SupabaseHeartbeatRecorder({
      rpc: async () => ({
        data: null,
        error: { message: 'database unavailable' },
      }),
    })
    await expect(failed.record('c'.repeat(64))).rejects.toThrow(
      'heartbeat persistence failed',
    )
  })
})
