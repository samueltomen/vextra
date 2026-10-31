import {
  createMonitor,
  maxCronGapSeconds,
  parseCronExpression,
  type Monitor,
} from '@vextra/domain'

export type CronSchedule = Readonly<{ expression: string; timezone: string }>

export type NewMonitorRecord = Readonly<{
  cron?: CronSchedule
  monitor: Monitor
  heartbeatTokenHash: string
  heartbeatTokenPrefix: string
}>

export interface MonitorRepositoryPort {
  save(record: NewMonitorRecord): Promise<void>
}

export type CreateMonitorInput = Readonly<{
  cron?: CronSchedule | undefined
  graceSeconds: number
  intervalSeconds?: number | undefined
  tenantId: string
}>

export type CreateMonitorResult = Readonly<{
  monitor: Monitor
  heartbeatToken: string
}>

export type CreateMonitorDependencies = Readonly<{
  clock: Readonly<{ nowMs: () => number }>
  idGenerator: Readonly<{ generate: () => string }>
  repository: MonitorRepositoryPort
  tokenGenerator: Readonly<{
    generate: () => Promise<{
      token: string
      hash: string
      prefix: string
    }>
  }>
}>

export class CreateMonitor {
  constructor(private readonly dependencies: CreateMonitorDependencies) {}

  async execute(input: CreateMonitorInput): Promise<CreateMonitorResult> {
    const nowMs = this.dependencies.clock.nowMs()
    let intervalSeconds = input.intervalSeconds

    if (input.cron) {
      // The interval of a cron monitor is its longest gap, so a deadline is
      // never earlier than the real next run (it is refined right after).
      intervalSeconds = maxCronGapSeconds(
        parseCronExpression(input.cron.expression),
        nowMs,
        input.cron.timezone,
      )
    }

    if (intervalSeconds === undefined) {
      throw new RangeError('an interval or a cron schedule is required')
    }

    const monitor = createMonitor({
      id: this.dependencies.idGenerator.generate(),
      tenantId: input.tenantId,
      intervalSeconds,
      graceSeconds: input.graceSeconds,
      nowMs,
    })
    const heartbeatToken = await this.dependencies.tokenGenerator.generate()

    await this.dependencies.repository.save({
      ...(input.cron ? { cron: input.cron } : {}),
      monitor,
      heartbeatTokenHash: heartbeatToken.hash,
      heartbeatTokenPrefix: heartbeatToken.prefix,
    })

    return {
      monitor,
      heartbeatToken: heartbeatToken.token,
    }
  }
}
