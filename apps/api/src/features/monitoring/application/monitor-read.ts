import type { MonitorStatus } from '@vextra/domain'

export type MonitorStateRecord = Readonly<{
  alertAtMs: number
  alertsEnabled: boolean
  tags: readonly string[]
  createdAtMs: number
  cronExpression: string | null
  cronTimezone: string | null
  description: string | null
  folderId: string | null
  graceSeconds: number
  id: string
  incidentOpenedAtMs: number | null
  intervalSeconds: number
  lastHeartbeatAtMs: number | null
  name: string | null
  notes: string | null
  pausedAtMs: number | null
  runningSinceMs: number | null
  status: MonitorStatus
  tenantId: string
  totalPings: number
}>

export interface MonitorQueryPort {
  findAllByTenant(tenantId: string): Promise<readonly MonitorStateRecord[]>
  findById(
    tenantId: string,
    monitorId: string,
  ): Promise<MonitorStateRecord | null>
}

export class MonitorReadService {
  constructor(private readonly repository: MonitorQueryPort) {}

  async list(tenantId: string): Promise<readonly MonitorStateRecord[]> {
    return this.repository.findAllByTenant(tenantId)
  }

  async get(
    tenantId: string,
    monitorId: string,
  ): Promise<MonitorStateRecord | null> {
    return this.repository.findById(tenantId, monitorId)
  }
}
