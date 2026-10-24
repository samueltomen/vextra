import type {
  MonitorIncidentPort,
  MonitorIncidentRecord,
} from '../../application/monitor-incidents.ts'

const INCIDENT_COLUMNS =
  'id, monitor_id, opened_at, resolved_at, reason, resolution_reason'

type IncidentRow = Readonly<{
  id: string
  monitor_id: string
  opened_at: string
  reason: 'heartbeat_missed'
  resolution_reason: 'heartbeat_received' | 'manual' | null
  resolved_at: string | null
}>

type IncidentListResult = PromiseLike<
  Readonly<{
    data: IncidentRow[] | null
    error: Readonly<{ message: string }> | null
  }>
>

export type MonitorIncidentQueryClient = Readonly<{
  from(table: 'incidents'): Readonly<{
    select(columns: typeof INCIDENT_COLUMNS): Readonly<{
      eq(
        column: 'monitor_id',
        value: string,
      ): Readonly<{
        order(
          column: 'opened_at',
          options: Readonly<{ ascending: boolean }>,
        ): IncidentListResult
      }>
    }>
  }>
}>

function toNullableTimestamp(value: string | null): number | null {
  return value === null ? null : Date.parse(value)
}

function toRecord(row: IncidentRow): MonitorIncidentRecord {
  return {
    id: row.id,
    monitorId: row.monitor_id,
    openedAtMs: Date.parse(row.opened_at),
    reason: row.reason,
    resolutionReason: row.resolution_reason,
    resolvedAtMs: toNullableTimestamp(row.resolved_at),
  }
}

export class SupabaseMonitorIncidentRepository implements MonitorIncidentPort {
  constructor(private readonly client: MonitorIncidentQueryClient) {}

  async listByMonitor(
    monitorId: string,
  ): Promise<readonly MonitorIncidentRecord[]> {
    const { data, error } = await this.client
      .from('incidents')
      .select(INCIDENT_COLUMNS)
      .eq('monitor_id', monitorId)
      .order('opened_at', { ascending: false })

    if (error || !data) {
      throw new Error('incident query failed')
    }

    return data.map(toRecord)
  }
}
