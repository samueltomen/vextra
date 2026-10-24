export type MonitorStatus = 'healthy' | 'late' | 'paused' | 'pending'

export type MonitorView = Readonly<{
  id: string
  tenantId: string
  localLabel: string
  intervalMinutes: number
  graceMinutes: number
  status: MonitorStatus
  lastHeartbeatAtMs: number | null
  alertAtMs: number
  channel: 'email' | 'discord'
}>

export type MonitorSummary = Readonly<{
  healthy: number
  late: number
  paused: number
  pending: number
  total: number
}>

export function summarizeMonitors(
  monitors: readonly MonitorView[],
): MonitorSummary {
  const summary = {
    healthy: 0,
    late: 0,
    paused: 0,
    pending: 0,
    total: monitors.length,
  }

  for (const monitor of monitors) {
    summary[monitor.status] += 1
  }

  return summary
}
