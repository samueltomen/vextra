export type MonitorStatus = 'healthy' | 'late' | 'paused' | 'pending'

export type StatusFilter = 'all' | MonitorStatus

export type MonitorView = Readonly<{
  alertAtMs: number
  alertsEnabled: boolean
  createdAtMs: number
  cronExpression: string | null
  cronTimezone: string | null
  description: string | null
  folderId: string | null
  graceMinutes: number
  id: string
  incidentOpenedAtMs: number | null
  intervalMinutes: number
  localLabel: string
  lastHeartbeatAtMs: number | null
  notes: string | null
  runningSinceMs: number | null
  /** Server-side name; `localLabel` is the name actually displayed. */
  serverName: string | null
  status: MonitorStatus
  totalPings: number
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
