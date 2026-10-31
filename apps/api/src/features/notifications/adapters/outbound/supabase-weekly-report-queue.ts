import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  WeeklyReport,
  WeeklyReportQueue,
} from '../../application/send-weekly-reports.ts'

type ClaimRow = Readonly<{
  display_name: string | null
  email: string
  fails_7d: number | string
  incidents_open_now: number
  incidents_opened: number
  monitors_total: number
  pings_7d: number | string
  problem_monitors: readonly Readonly<{
    id: string
    incidents: number
    name: string | null
  }>[]
  tenant_id: string
  week_start: string
}>

export class SupabaseWeeklyReportQueue implements WeeklyReportQueue {
  constructor(private readonly serviceClient: SupabaseClient) {}

  async claim(nowMs: number): Promise<readonly WeeklyReport[]> {
    const { data, error } = await this.serviceClient.rpc(
      'claim_weekly_reports',
      { p_now: new Date(nowMs).toISOString() },
    )

    if (error || !data) {
      throw new Error('weekly report claim failed')
    }

    return (data as readonly ClaimRow[]).map((row) => ({
      displayName: row.display_name,
      email: row.email,
      fails7d: Number(row.fails_7d),
      incidentsOpenNow: row.incidents_open_now,
      incidentsOpened: row.incidents_opened,
      monitorsTotal: row.monitors_total,
      pings7d: Number(row.pings_7d),
      problemMonitors: row.problem_monitors ?? [],
      tenantId: row.tenant_id,
      weekStart: row.week_start,
    }))
  }

  async complete(
    result: Readonly<{
      success: boolean
      tenantId: string
      weekStart: string
    }>,
  ): Promise<void> {
    const { data, error } = await this.serviceClient.rpc(
      'complete_weekly_report',
      {
        p_success: result.success,
        p_tenant_id: result.tenantId,
        p_week_start: result.weekStart,
      },
    )

    if (error || data !== true) {
      throw new Error('weekly report completion failed')
    }
  }
}
