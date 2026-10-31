export type WeeklyReportProblemMonitor = Readonly<{
  id: string
  incidents: number
  name: string | null
}>

export type WeeklyReport = Readonly<{
  displayName: string | null
  email: string
  fails7d: number
  incidentsOpenNow: number
  incidentsOpened: number
  monitorsTotal: number
  pings7d: number
  problemMonitors: readonly WeeklyReportProblemMonitor[]
  tenantId: string
  weekStart: string
}>

export interface WeeklyReportQueue {
  claim(nowMs: number): Promise<readonly WeeklyReport[]>
  complete(
    result: Readonly<{
      success: boolean
      tenantId: string
      weekStart: string
    }>,
  ): Promise<void>
}

export interface WeeklyReportSender {
  send(report: WeeklyReport): Promise<void>
}

/**
 * Sends the Monday report. The database decides who is due and guarantees at
 * most one report per tenant and week (with a few retries after a failure).
 */
export class SendWeeklyReports {
  constructor(
    private readonly dependencies: Readonly<{
      queue: WeeklyReportQueue
      sender: WeeklyReportSender
    }>,
  ) {}

  async execute(nowMs: number): Promise<{ failed: number; sent: number }> {
    const reports = await this.dependencies.queue.claim(nowMs)
    let failed = 0
    let sent = 0

    for (const report of reports) {
      try {
        await this.dependencies.sender.send(report)
        await this.dependencies.queue.complete({
          success: true,
          tenantId: report.tenantId,
          weekStart: report.weekStart,
        })
        sent += 1
      } catch {
        await this.dependencies.queue.complete({
          success: false,
          tenantId: report.tenantId,
          weekStart: report.weekStart,
        })
        failed += 1
      }
    }

    return { failed, sent }
  }
}
