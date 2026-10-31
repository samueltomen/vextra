import {
  assertMonitorSchedule,
  maxCronGapSeconds,
  parseCronExpression,
} from '@cronping/domain'

export type UpdateMonitorScheduleInput = Readonly<{
  cron?: Readonly<{ expression: string; timezone: string }> | undefined
  graceSeconds: number
  intervalSeconds?: number | undefined
  monitorId: string
}>

export type MonitorScheduleChange = Readonly<{
  cron: Readonly<{ expression: string; timezone: string }> | null
  graceSeconds: number
  intervalSeconds: number
  monitorId: string
}>

export interface MonitorSchedulePort {
  update(change: MonitorScheduleChange): Promise<boolean>
}

export class UpdateMonitorSchedule {
  constructor(
    private readonly dependencies: Readonly<{
      nowMs: () => number
      port: MonitorSchedulePort
    }>,
  ) {}

  async execute(input: UpdateMonitorScheduleInput): Promise<boolean> {
    let intervalSeconds = input.intervalSeconds

    if (input.cron) {
      // The interval of a cron monitor is its longest gap (see CreateMonitor).
      intervalSeconds = maxCronGapSeconds(
        parseCronExpression(input.cron.expression),
        this.dependencies.nowMs(),
        input.cron.timezone,
      )
    }

    if (intervalSeconds === undefined) {
      throw new RangeError('an interval or a cron schedule is required')
    }

    assertMonitorSchedule(intervalSeconds, input.graceSeconds)

    return this.dependencies.port.update({
      cron: input.cron ?? null,
      graceSeconds: input.graceSeconds,
      intervalSeconds,
      monitorId: input.monitorId,
    })
  }
}
