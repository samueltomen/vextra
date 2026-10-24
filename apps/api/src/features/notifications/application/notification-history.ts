export type NotificationHistoryRecord = Readonly<{
  attempts: number
  createdAtMs: number
  id: string
  kind: 'incident_opened' | 'incident_resolved'
  monitorId: string
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'dead'
  updatedAtMs: number
}>

export interface NotificationHistoryPort {
  listByTenant(tenantId: string): Promise<readonly NotificationHistoryRecord[]>
}

export class NotificationHistory {
  constructor(private readonly port: NotificationHistoryPort) {}

  async list(tenantId: string): Promise<readonly NotificationHistoryRecord[]> {
    return this.port.listByTenant(tenantId)
  }
}
