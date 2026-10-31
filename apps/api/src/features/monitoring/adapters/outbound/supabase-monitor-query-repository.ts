import type { MonitorStatus } from '@cronping/domain'

import type {
  MonitorQueryPort,
  MonitorStateRecord,
} from '../../application/monitor-read.ts'

const MONITOR_STATE_COLUMNS =
  'id, tenant_id, interval_seconds, grace_seconds, status, last_heartbeat_at, alert_at, incident_opened_at, paused_at, created_at, folder_id, total_pings, name, description, notes, alerts_enabled, running_since'

type MonitorStateRow = Readonly<{
  alert_at: string
  alerts_enabled: boolean
  created_at: string
  description: string | null
  folder_id: string | null
  grace_seconds: number
  id: string
  incident_opened_at: string | null
  interval_seconds: number
  last_heartbeat_at: string | null
  name: string | null
  notes: string | null
  paused_at: string | null
  running_since: string | null
  status: MonitorStatus
  tenant_id: string
  total_pings: number
}>

type QueryError = Readonly<{ message: string }>

type ListResult = PromiseLike<
  Readonly<{ data: MonitorStateRow[] | null; error: QueryError | null }>
>

type DetailResult = PromiseLike<
  Readonly<{ data: MonitorStateRow | null; error: QueryError | null }>
>

type TenantFilter = Readonly<{
  eq(
    column: 'id',
    value: string,
  ): Readonly<{
    maybeSingle(): DetailResult
  }>
  order(
    column: 'created_at',
    options: Readonly<{ ascending: boolean }>,
  ): ListResult
}>

export type MonitorQueryClient = Readonly<{
  from(table: 'monitors'): Readonly<{
    select(columns: typeof MONITOR_STATE_COLUMNS): Readonly<{
      eq(column: 'tenant_id', value: string): TenantFilter
    }>
  }>
}>

function toTimestamp(value: string): number {
  return Date.parse(value)
}

function toNullableTimestamp(value: string | null): number | null {
  return value === null ? null : toTimestamp(value)
}

function toRecord(row: MonitorStateRow): MonitorStateRecord {
  return {
    alertAtMs: toTimestamp(row.alert_at),
    alertsEnabled: row.alerts_enabled,
    createdAtMs: toTimestamp(row.created_at),
    description: row.description,
    folderId: row.folder_id,
    graceSeconds: row.grace_seconds,
    id: row.id,
    incidentOpenedAtMs: toNullableTimestamp(row.incident_opened_at),
    intervalSeconds: row.interval_seconds,
    lastHeartbeatAtMs: toNullableTimestamp(row.last_heartbeat_at),
    name: row.name,
    notes: row.notes,
    pausedAtMs: toNullableTimestamp(row.paused_at),
    runningSinceMs: toNullableTimestamp(row.running_since),
    status: row.status,
    tenantId: row.tenant_id,
    totalPings: Number(row.total_pings),
  }
}

export class SupabaseMonitorQueryRepository implements MonitorQueryPort {
  constructor(private readonly client: MonitorQueryClient) {}

  async findAllByTenant(
    tenantId: string,
  ): Promise<readonly MonitorStateRecord[]> {
    const { data, error } = await this.client
      .from('monitors')
      .select(MONITOR_STATE_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error || !data) {
      throw new Error('monitor query failed')
    }

    return data.map(toRecord)
  }

  async findById(
    tenantId: string,
    monitorId: string,
  ): Promise<MonitorStateRecord | null> {
    const { data, error } = await this.client
      .from('monitors')
      .select(MONITOR_STATE_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', monitorId)
      .maybeSingle()

    if (error) {
      throw new Error('monitor query failed')
    }

    return data ? toRecord(data) : null
  }
}
