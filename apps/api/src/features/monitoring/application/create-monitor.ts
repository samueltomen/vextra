import { createMonitor, type Monitor } from '@cronping/domain'

export type NewMonitorRecord = Readonly<{
  monitor: Monitor
  heartbeatTokenHash: string
  heartbeatTokenPrefix: string
}>

export interface MonitorRepositoryPort {
  save(record: NewMonitorRecord): Promise<void>
}

export type CreateMonitorInput = Readonly<{
  tenantId: string
  intervalSeconds: number
  graceSeconds: number
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
    const monitor = createMonitor({
      id: this.dependencies.idGenerator.generate(),
      tenantId: input.tenantId,
      intervalSeconds: input.intervalSeconds,
      graceSeconds: input.graceSeconds,
      nowMs: this.dependencies.clock.nowMs(),
    })
    const heartbeatToken = await this.dependencies.tokenGenerator.generate()

    await this.dependencies.repository.save({
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
