import type { MonitorStatus } from '@cronping/domain'

export type MonitorStateRecord = Readonly<{
  alertAtMs: number
  createdAtMs: number
  graceSeconds: number
  id: string
  incidentOpenedAtMs: number | null
  intervalSeconds: number
  lastHeartbeatAtMs: number | null
  pausedAtMs: number | null
  status: MonitorStatus
  tenantId: string
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
