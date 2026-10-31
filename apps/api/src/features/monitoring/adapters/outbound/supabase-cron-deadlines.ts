import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  CronDeadlinePort,
  StaleCronMonitor,
} from '../../application/refine-cron-deadlines.ts'

type ClaimRow = Readonly<{
  cron_expression: string
  cron_timezone: string
  grace_seconds: number
  last_heartbeat_at: string | null
  monitor_id: string
}>

/** Service role only: these functions are not granted to any client role. */
export class SupabaseCronDeadlines implements CronDeadlinePort {
  constructor(private readonly serviceClient: SupabaseClient) {}

  async claim(batchSize: number): Promise<readonly StaleCronMonitor[]> {
    const { data, error } = await this.serviceClient.rpc(
      'claim_stale_cron_monitors',
      { p_batch_size: batchSize },
    )

    if (error || !data) {
      throw new Error('cron deadline claim failed')
    }

    return (data as readonly ClaimRow[]).map((row) => ({
      cronExpression: row.cron_expression,
      cronTimezone: row.cron_timezone,
      graceSeconds: row.grace_seconds,
      lastHeartbeatAt: row.last_heartbeat_at,
      monitorId: row.monitor_id,
    }))
  }

  async apply(
    input: Readonly<{
      alertAtMs: number
      expectedHeartbeatAt: string | null
      monitorId: string
    }>,
  ): Promise<boolean> {
    const { data, error } = await this.serviceClient.rpc('set_cron_deadline', {
      p_alert_at: new Date(input.alertAtMs).toISOString(),
      p_expected_heartbeat_at: input.expectedHeartbeatAt,
      p_monitor_id: input.monitorId,
    })

    if (error) {
      throw new Error('cron deadline update failed')
    }

    return data === true
  }
}
