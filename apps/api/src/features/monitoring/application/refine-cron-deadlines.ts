import { nextCronOccurrence, parseCronExpression } from '@cronping/domain'

export type StaleCronMonitor = Readonly<{
  cronExpression: string
  cronTimezone: string
  graceSeconds: number
  /** Raw timestamp as stored (microsecond precision), echoed back verbatim. */
  lastHeartbeatAt: string | null
  monitorId: string
}>

export interface CronDeadlinePort {
  apply(
    input: Readonly<{
      alertAtMs: number
      expectedHeartbeatAt: string | null
      monitorId: string
    }>,
  ): Promise<boolean>
  claim(batchSize: number): Promise<readonly StaleCronMonitor[]>
}

/**
 * Computes the exact deadline of cron monitors after a heartbeat or a schedule
 * change: the next occurrence after the last heartbeat, plus the grace period.
 * A deadline already in the past (a run was missed) is set to "now" so the next
 * check opens the incident immediately.
 */
export class RefineCronDeadlines {
  constructor(
    private readonly dependencies: Readonly<{
      nowMs: () => number
      port: CronDeadlinePort
    }>,
  ) {}

  async execute(
    batchSize = 100,
  ): Promise<{ applied: number; skipped: number }> {
    const monitors = await this.dependencies.port.claim(batchSize)
    const nowMs = this.dependencies.nowMs()
    let applied = 0
    let skipped = 0

    for (const monitor of monitors) {
      try {
        const schedule = parseCronExpression(monitor.cronExpression)
        const reference =
          monitor.lastHeartbeatAt === null
            ? nowMs
            : Date.parse(monitor.lastHeartbeatAt)
        const next = nextCronOccurrence(
          schedule,
          reference,
          monitor.cronTimezone,
        )

        if (next === null) {
          skipped += 1

          continue
        }

        const alertAtMs = Math.max(next + monitor.graceSeconds * 1_000, nowMs)
        const done = await this.dependencies.port.apply({
          alertAtMs,
          expectedHeartbeatAt: monitor.lastHeartbeatAt,
          monitorId: monitor.monitorId,
        })

        if (done) {
          applied += 1
        } else {
          // A heartbeat arrived meanwhile: the monitor is flagged again.
          skipped += 1
        }
      } catch {
        skipped += 1
      }
    }

    return { applied, skipped }
  }
}
