import type {
  MonitorRepositoryPort,
  NewMonitorRecord,
} from '../../application/create-monitor.ts'

type MonitorInsertRow = Readonly<{
  id: string
  tenant_id: string
  heartbeat_token_hash: string
  heartbeat_token_prefix: string
  interval_seconds: number
  grace_seconds: number
  status: string
  last_heartbeat_at: string | null
  alert_at: string
  incident_opened_at: string | null
  paused_at: string | null
  enabled: boolean
}>

type InsertResult = Readonly<{
  error: Readonly<{ message: string }> | null
}>

export type MonitorInsertClient = Readonly<{
  from(table: 'monitors'): Readonly<{
    insert(row: MonitorInsertRow): PromiseLike<InsertResult>
  }>
}>

function toIsoString(timestampMs: number | null): string | null {
  return timestampMs === null ? null : new Date(timestampMs).toISOString()
}

function toInsertRow(record: NewMonitorRecord): MonitorInsertRow {
  return {
    id: record.monitor.id,
    tenant_id: record.monitor.tenantId,
    heartbeat_token_hash: record.heartbeatTokenHash,
    heartbeat_token_prefix: record.heartbeatTokenPrefix,
    interval_seconds: record.monitor.intervalSeconds,
    grace_seconds: record.monitor.graceSeconds,
    status: record.monitor.status,
    last_heartbeat_at: toIsoString(record.monitor.lastHeartbeatAtMs),
    alert_at: new Date(record.monitor.alertAtMs).toISOString(),
    incident_opened_at: toIsoString(record.monitor.incidentOpenedAtMs),
    paused_at: toIsoString(record.monitor.pausedAtMs),
    enabled: true,
  }
}

export class SupabaseMonitorRepository implements MonitorRepositoryPort {
  constructor(private readonly client: MonitorInsertClient) {}

  async save(record: NewMonitorRecord): Promise<void> {
    const { error } = await this.client
      .from('monitors')
      .insert(toInsertRow(record))

    if (error) {
      throw new Error('monitor persistence failed')
    }
  }
}
