import { describe, expect, it, vi } from 'vitest'

import { SupabaseMonitorSchedule } from './supabase-monitor-schedule.ts'

const INPUT = {
  cron: null,
  graceSeconds: 120,
  intervalSeconds: 900,
  monitorId: '20000000-0000-4000-8000-000000000001',
} as const

describe('SupabaseMonitorSchedule', () => {
  it('calls the dedicated RPC with the schedule', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }))

    await expect(
      new SupabaseMonitorSchedule({ rpc }).update(INPUT),
    ).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('update_monitor_schedule_v2', {
      p_cron_expression: null,
      p_cron_timezone: null,
      p_grace_seconds: 120,
      p_interval_seconds: 900,
      p_monitor_id: INPUT.monitorId,
    })
  })

  it('sends the cron expression and its time zone', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }))

    await new SupabaseMonitorSchedule({ rpc }).update({
      ...INPUT,
      cron: { expression: '0 3 * * *', timezone: 'Europe/Paris' },
    })
    expect(rpc).toHaveBeenCalledWith(
      'update_monitor_schedule_v2',
      expect.objectContaining({
        p_cron_expression: '0 3 * * *',
        p_cron_timezone: 'Europe/Paris',
      }),
    )
  })

  it('returns false when the monitor is not visible to the caller', async () => {
    const schedule = new SupabaseMonitorSchedule({
      rpc: async () => ({ data: false, error: null }),
    })

    await expect(schedule.update(INPUT)).resolves.toBe(false)
  })

  it('rejects provider failures without leaking their message', async () => {
    const schedule = new SupabaseMonitorSchedule({
      rpc: async () => ({
        data: null,
        error: { message: 'permission denied for table monitors' },
      }),
    })

    await expect(schedule.update(INPUT)).rejects.toThrow(
      'monitor schedule update failed',
    )
  })
})
