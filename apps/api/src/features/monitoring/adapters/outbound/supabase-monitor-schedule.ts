import type {
  MonitorScheduleChange,
  MonitorSchedulePort,
} from '../../application/update-monitor-schedule.ts'

export type MonitorScheduleRpcClient = Readonly<{
  rpc(
    functionName: 'update_monitor_schedule_v2',
    args: Readonly<{
      p_cron_expression: string | null
      p_cron_timezone: string | null
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

  async update(change: MonitorScheduleChange): Promise<boolean> {
    const { data, error } = await this.client.rpc(
      'update_monitor_schedule_v2',
      {
        p_cron_expression: change.cron?.expression ?? null,
        p_cron_timezone: change.cron?.timezone ?? null,
        p_grace_seconds: change.graceSeconds,
        p_interval_seconds: change.intervalSeconds,
        p_monitor_id: change.monitorId,
      },
    )

    if (error) {
      throw new Error('monitor schedule update failed')
    }

    return data === true
  }
}
