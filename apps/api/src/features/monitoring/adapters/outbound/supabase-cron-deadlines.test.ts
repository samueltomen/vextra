import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { SupabaseCronDeadlines } from './supabase-cron-deadlines.ts'

function client(result: { data?: unknown; error?: object | null }) {
  const rpc = vi.fn(async () => ({
    data: result.data ?? null,
    error: result.error ?? null,
  }))

  return { rpc, supabase: { rpc } as unknown as SupabaseClient }
}

describe('SupabaseCronDeadlines', () => {
  it('claims stale cron monitors and keeps the raw heartbeat timestamp', async () => {
    const { rpc, supabase } = client({
      data: [
        {
          cron_expression: '0 3 * * *',
          cron_timezone: 'Europe/Paris',
          grace_seconds: 300,
          last_heartbeat_at: '2026-10-31T03:00:20.123456+00:00',
          monitor_id: 'm1',
        },
      ],
    })

    await expect(
      new SupabaseCronDeadlines(supabase).claim(100),
    ).resolves.toEqual([
      {
        cronExpression: '0 3 * * *',
        cronTimezone: 'Europe/Paris',
        graceSeconds: 300,
        lastHeartbeatAt: '2026-10-31T03:00:20.123456+00:00',
        monitorId: 'm1',
      },
    ])
    expect(rpc).toHaveBeenCalledWith('claim_stale_cron_monitors', {
      p_batch_size: 100,
    })
  })

  it('applies a deadline against the heartbeat it was computed from', async () => {
    const { rpc, supabase } = client({ data: true })

    await expect(
      new SupabaseCronDeadlines(supabase).apply({
        alertAtMs: Date.parse('2026-11-01T03:05:00.000Z'),
        expectedHeartbeatAt: '2026-10-31T03:00:20.123456+00:00',
        monitorId: 'm1',
      }),
    ).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('set_cron_deadline', {
      p_alert_at: '2026-11-01T03:05:00.000Z',
      p_expected_heartbeat_at: '2026-10-31T03:00:20.123456+00:00',
      p_monitor_id: 'm1',
    })
  })

  it('reports a refused update and fails closed on errors', async () => {
    await expect(
      new SupabaseCronDeadlines(client({ data: false }).supabase).apply({
        alertAtMs: 0,
        expectedHeartbeatAt: null,
        monitorId: 'm',
      }),
    ).resolves.toBe(false)

    const failing = new SupabaseCronDeadlines(
      client({ error: { code: 'x' } }).supabase,
    )

    await expect(failing.claim(1)).rejects.toThrow('cron deadline claim failed')
    await expect(
      failing.apply({
        alertAtMs: 0,
        expectedHeartbeatAt: null,
        monitorId: 'm',
      }),
    ).rejects.toThrow('cron deadline update failed')
  })
})
