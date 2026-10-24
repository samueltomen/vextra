import type {
  MonitorSchedulePort,
  UpdateMonitorScheduleInput,
} from '../../application/update-monitor-schedule.ts'

export type MonitorScheduleRpcClient = Readonly<{
  rpc(
    functionName: 'update_monitor_schedule',
    args: Readonly<{
      p_grace_seconds: number
      p_interval_seconds: number
      p_monitor_id: string
    }>,
  ): PromiseLike<
    Readonly<{
      data: boolean | null
      error: Readonly<{ message: string }> | null
    }>
  >
}>

export class SupabaseMonitorSchedule implements MonitorSchedulePort {
  constructor(private readonly client: MonitorScheduleRpcClient) {}

  async update(input: UpdateMonitorScheduleInput): Promise<boolean> {
    const { data, error } = await this.client.rpc('update_monitor_schedule', {
      p_grace_seconds: input.graceSeconds,
      p_interval_seconds: input.intervalSeconds,
      p_monitor_id: input.monitorId,
    })

    if (error) {
      throw new Error('monitor schedule update failed')
    }

    return data === true
  }
}
