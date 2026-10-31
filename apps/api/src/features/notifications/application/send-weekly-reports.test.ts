import { describe, expect, it, vi } from 'vitest'

import {
  SendWeeklyReports,
  type WeeklyReport,
  type WeeklyReportQueue,
} from './send-weekly-reports.ts'

const REPORT: WeeklyReport = {
  displayName: 'Ada',
  email: 'owner@example.test',
  fails7d: 2,
  incidentsOpenNow: 0,
  incidentsOpened: 1,
  monitorsTotal: 3,
  pings7d: 120,
  problemMonitors: [{ id: 'm1', incidents: 1, name: 'Sync' }],
  tenantId: 't1',
  weekStart: '2026-11-02',
}

function queue(reports: readonly WeeklyReport[]) {
  return {
    claim: vi.fn(async () => reports),
    complete: vi.fn(async () => undefined),
  } satisfies WeeklyReportQueue
}

describe('SendWeeklyReports', () => {
  it('sends each claimed report and confirms it', async () => {
    const jobs = queue([REPORT])
    const sender = { send: vi.fn(async () => undefined) }

    await expect(
      new SendWeeklyReports({ queue: jobs, sender }).execute(1_000),
    ).resolves.toEqual({ failed: 0, sent: 1 })
    expect(jobs.claim).toHaveBeenCalledWith(1_000)
    expect(sender.send).toHaveBeenCalledWith(REPORT)
    expect(jobs.complete).toHaveBeenCalledWith({
      success: true,
      tenantId: 't1',
      weekStart: '2026-11-02',
    })
  })

  it('reports a failure without stopping the other reports', async () => {
    const other = { ...REPORT, tenantId: 't2' }
    const jobs = queue([REPORT, other])
    const send = vi
      .fn<(report: WeeklyReport) => Promise<void>>()
      .mockRejectedValueOnce(new Error('resend down'))
      .mockResolvedValueOnce(undefined)

    await expect(
      new SendWeeklyReports({ queue: jobs, sender: { send } }).execute(1),
    ).resolves.toEqual({ failed: 1, sent: 1 })
    expect(jobs.complete).toHaveBeenCalledWith({
      success: false,
      tenantId: 't1',
      weekStart: '2026-11-02',
    })
    expect(jobs.complete).toHaveBeenCalledWith({
      success: true,
      tenantId: 't2',
      weekStart: '2026-11-02',
    })
  })

  it('does nothing when no report is due', async () => {
    const sender = { send: vi.fn() }

    await expect(
      new SendWeeklyReports({ queue: queue([]), sender }).execute(1),
    ).resolves.toEqual({ failed: 0, sent: 0 })
    expect(sender.send).not.toHaveBeenCalled()
  })
})
