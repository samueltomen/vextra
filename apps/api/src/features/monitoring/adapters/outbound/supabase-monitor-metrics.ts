import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  MonitorMetricsPort,
  MonitorMetricsRecord,
} from '../../application/monitor-metrics.ts'

type DayRow = Readonly<{
  day: string
  gap_count: number
  gap_max_seconds: number
  gap_sum_seconds: number
  pings: number
}>

export class SupabaseMonitorMetrics implements MonitorMetricsPort {
  constructor(private readonly client: SupabaseClient) {}

  async find(
    tenantId: string,
    monitorId: string,
    sinceDay: string,
  ): Promise<MonitorMetricsRecord | null> {
    const monitor = await this.client
      .from('monitors')
      .select('total_pings')
      .eq('tenant_id', tenantId)
      .eq('id', monitorId)
      .maybeSingle()

    if (monitor.error) {
      throw new Error('metrics query failed')
    }

    if (!monitor.data) {
      return null
    }

    const stats = await this.client
      .from('monitor_daily_stats')
      .select('day, pings, gap_count, gap_sum_seconds, gap_max_seconds')
      .eq('tenant_id', tenantId)
      .eq('monitor_id', monitorId)
      .gte('day', sinceDay)
      .order('day', { ascending: true })

    if (stats.error) {
      throw new Error('metrics query failed')
    }

    return {
      days: ((stats.data ?? []) as readonly DayRow[]).map((row) => ({
        day: row.day,
        gapCount: Number(row.gap_count),
        gapMaxSeconds: Number(row.gap_max_seconds),
        gapSumSeconds: Number(row.gap_sum_seconds),
        pings: Number(row.pings),
      })),
      totalPings: Number((monitor.data as { total_pings: number }).total_pings),
    }
  }
}
