export type MonitorIncidentRecord = Readonly<{
  id: string
  monitorId: string
  openedAtMs: number
  reason: 'heartbeat_missed' | 'run_failed'
  resolutionReason: 'heartbeat_received' | 'manual' | null
  resolvedAtMs: number | null
}>

export interface MonitorIncidentPort {
  listByMonitor(monitorId: string): Promise<readonly MonitorIncidentRecord[]>
}

export class MonitorIncidents {
  constructor(private readonly port: MonitorIncidentPort) {}

  async list(monitorId: string): Promise<readonly MonitorIncidentRecord[]> {
    return this.port.listByMonitor(monitorId)
  }
}
