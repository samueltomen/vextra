import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { SupabaseWeeklyReportQueue } from './supabase-weekly-report-queue.ts'

function client(result: { data?: unknown; error?: { code?: string } | null }) {
  const rpc = vi.fn(async () => ({
    data: result.data ?? null,
    error: result.error ?? null,
  }))

  return { rpc, supabase: { rpc } as unknown as SupabaseClient }
}

describe('SupabaseWeeklyReportQueue', () => {
  it('claims the reports due now and maps database rows', async () => {
    const { rpc, supabase } = client({
      data: [
        {
          display_name: null,
          email: 'owner@example.test',
          fails_7d: '4',
          incidents_open_now: 1,
          incidents_opened: 2,
          monitors_total: 3,
          pings_7d: '250',
          problem_monitors: [{ id: 'm1', incidents: 2, name: 'Sync' }],
          tenant_id: 't1',
          week_start: '2026-11-02',
        },
      ],
    })

    await expect(
      new SupabaseWeeklyReportQueue(supabase).claim(
        Date.parse('2026-11-02T09:30:00.000Z'),
      ),
    ).resolves.toEqual([
      {
        displayName: null,
        email: 'owner@example.test',
        fails7d: 4,
        incidentsOpenNow: 1,
        incidentsOpened: 2,
        monitorsTotal: 3,
        pings7d: 250,
        problemMonitors: [{ id: 'm1', incidents: 2, name: 'Sync' }],
        tenantId: 't1',
        weekStart: '2026-11-02',
      },
    ])
    expect(rpc).toHaveBeenCalledWith('claim_weekly_reports', {
      p_now: '2026-11-02T09:30:00.000Z',
    })
  })

  it('confirms or releases a report through the dedicated RPC', async () => {
    const { rpc, supabase } = client({ data: true })

    await new SupabaseWeeklyReportQueue(supabase).complete({
      success: false,
      tenantId: 't1',
      weekStart: '2026-11-02',
    })
    expect(rpc).toHaveBeenCalledWith('complete_weekly_report', {
      p_success: false,
      p_tenant_id: 't1',
      p_week_start: '2026-11-02',
    })
  })

  it('fails closed on database errors', async () => {
    const failing = new SupabaseWeeklyReportQueue(
      client({ error: { code: 'x' } }).supabase,
    )

    await expect(failing.claim(0)).rejects.toThrow('weekly report claim failed')
    await expect(
      failing.complete({ success: true, tenantId: 't', weekStart: 'w' }),
    ).rejects.toThrow('weekly report completion failed')
  })
})
