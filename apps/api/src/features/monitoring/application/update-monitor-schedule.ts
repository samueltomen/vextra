import { assertMonitorSchedule } from '@cronping/domain'

export type UpdateMonitorScheduleInput = Readonly<{
  graceSeconds: number
  intervalSeconds: number
  monitorId: string
}>

export interface MonitorSchedulePort {
  update(input: UpdateMonitorScheduleInput): Promise<boolean>
}

export class UpdateMonitorSchedule {
  constructor(private readonly port: MonitorSchedulePort) {}

  async execute(input: UpdateMonitorScheduleInput): Promise<boolean> {
    assertMonitorSchedule(input.intervalSeconds, input.graceSeconds)

    return this.port.update(input)
  }
}
