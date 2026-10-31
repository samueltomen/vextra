import type { MonitorIncidentView } from '../features/monitoring/api/monitoring-api.ts'
import type { MonitorView } from '../features/monitoring/model/monitor.ts'
import type { NotificationDeliveryView } from '../features/notifications/api/notifications-api.ts'

type DemoCreateInput = Readonly<{
  graceMinutes: number
  intervalMinutes: number
  localLabel: string
}>

const nowMs = Date.now()
const demoId = (suffix: string) =>
  `20000000-0000-4000-8000-${suffix.padStart(12, '0')}`

let monitors: MonitorView[] = [
  {
    alertAtMs: nowMs + 3_600_000,
    createdAtMs: nowMs - 86_400_000,
    folderId: '30000000-0000-4000-8000-000000000001',
    graceMinutes: 30,
    id: demoId('1'),
    incidentOpenedAtMs: null,
    intervalMinutes: 1_440,
    lastHeartbeatAtMs: nowMs - 2_520_000,
    localLabel: 'Sauvegarde PostgreSQL',
    status: 'healthy',
    totalPings: 0,
  },
  {
    alertAtMs: nowMs - 360_000,
    createdAtMs: nowMs - 86_400_000,
    folderId: '30000000-0000-4000-8000-000000000001',
    graceMinutes: 3,
    id: demoId('2'),
    incidentOpenedAtMs: nowMs - 360_000,
    intervalMinutes: 15,
    lastHeartbeatAtMs: nowMs - 1_440_000,
    localLabel: 'Synchronisation Stripe',
    status: 'late',
    totalPings: 0,
  },
  {
    alertAtMs: nowMs + 345_600_000,
    createdAtMs: nowMs - 604_800_000,
    folderId: null,
    graceMinutes: 120,
    id: demoId('3'),
    incidentOpenedAtMs: null,
    intervalMinutes: 10_080,
    lastHeartbeatAtMs: nowMs - 345_600_000,
    localLabel: 'Rapport hebdomadaire',
    status: 'paused',
    totalPings: 0,
  },
  {
    alertAtMs: nowMs + 21_600_000,
    createdAtMs: nowMs - 60_000,
    folderId: null,
    graceMinutes: 20,
    id: demoId('4'),
    incidentOpenedAtMs: null,
    intervalMinutes: 360,
    lastHeartbeatAtMs: null,
    localLabel: 'Nettoyage des médias',
    status: 'pending',
    totalPings: 0,
  },
]

let incidents: MonitorIncidentView[] = [
  {
    id: '60000000-0000-4000-8000-000000000001',
    openedAtMs: nowMs - 360_000,
    resolutionReason: null,
    resolvedAtMs: null,
  },
  {
    id: '60000000-0000-4000-8000-000000000002',
    openedAtMs: nowMs - 172_800_000,
    resolutionReason: 'heartbeat_received',
    resolvedAtMs: nowMs - 172_200_000,
  },
]

export async function listDemoMonitors(): Promise<readonly MonitorView[]> {
  return monitors.map((monitor) => ({ ...monitor }))
}

export async function getDemoMonitor(
  monitorId: string,
): Promise<MonitorView | null> {
  const monitor = monitors.find((candidate) => candidate.id === monitorId)

  return monitor ? { ...monitor } : null
}

export async function createDemoMonitor(input: DemoCreateInput) {
  const createdAtMs = Date.now()
  const monitor: MonitorView = {
    alertAtMs:
      createdAtMs + (input.intervalMinutes + input.graceMinutes) * 60_000,
    createdAtMs,
    folderId: null,
    graceMinutes: input.graceMinutes,
    id: crypto.randomUUID(),
    incidentOpenedAtMs: null,
    intervalMinutes: input.intervalMinutes,
    lastHeartbeatAtMs: null,
    localLabel: input.localLabel.trim(),
    status: 'pending',
    totalPings: 0,
  }

  monitors = [monitor, ...monitors]

  return {
    heartbeatToken: `cp_demo_${crypto.randomUUID().replaceAll('-', '')}`,
    monitor: { ...monitor },
  }
}

export function setDemoMonitorFolder(
  monitorId: string,
  folderId: string | null,
): void {
  monitors = monitors.map((monitor) =>
    monitor.id === monitorId ? { ...monitor, folderId } : monitor,
  )
}

export async function renameDemoMonitor(
  monitorId: string,
  label: string,
): Promise<void> {
  const localLabel = label.trim()

  if (!localLabel) {
    return
  }

  monitors = monitors.map((monitor) =>
    monitor.id === monitorId ? { ...monitor, localLabel } : monitor,
  )
}

export async function updateDemoMonitorSchedule(
  monitorId: string,
  schedule: Readonly<{ graceMinutes: number; intervalMinutes: number }>,
): Promise<void> {
  monitors = monitors.map((monitor) =>
    monitor.id === monitorId
      ? {
          ...monitor,
          alertAtMs:
            monitor.status === 'paused' || monitor.status === 'late'
              ? monitor.alertAtMs
              : Date.now() +
                (schedule.intervalMinutes + schedule.graceMinutes) * 60_000,
          graceMinutes: schedule.graceMinutes,
          intervalMinutes: schedule.intervalMinutes,
        }
      : monitor,
  )
}

export async function pauseDemoMonitor(monitorId: string): Promise<void> {
  const pausedAtMs = Date.now()
  monitors = monitors.map((monitor) =>
    monitor.id === monitorId
      ? {
          ...monitor,
          incidentOpenedAtMs: null,
          status: 'paused',
        }
      : monitor,
  )
  incidents = incidents.map((incident, index) =>
    index === 0
      ? { ...incident, resolutionReason: 'manual', resolvedAtMs: pausedAtMs }
      : incident,
  )
}

export async function resumeDemoMonitor(monitorId: string): Promise<void> {
  monitors = monitors.map((monitor) =>
    monitor.id === monitorId
      ? {
          ...monitor,
          alertAtMs:
            Date.now() +
            (monitor.intervalMinutes + monitor.graceMinutes) * 60_000,
          incidentOpenedAtMs: null,
          status: monitor.lastHeartbeatAtMs === null ? 'pending' : 'healthy',
        }
      : monitor,
  )
}

export async function deleteDemoMonitor(monitorId: string): Promise<void> {
  monitors = monitors.filter((monitor) => monitor.id !== monitorId)
}

export async function rotateDemoMonitorToken(
  monitorId: string,
): Promise<string | null> {
  const monitor = monitors.find((candidate) => candidate.id === monitorId)

  return monitor ? `cp_demo_${crypto.randomUUID().replaceAll('-', '')}` : null
}

export async function listDemoIncidents(
  monitorId: string,
): Promise<readonly MonitorIncidentView[]> {
  if (monitorId === demoId('2')) {
    return incidents.map((incident) => ({ ...incident }))
  }

  return []
}

export async function listDemoNotifications(): Promise<
  readonly NotificationDeliveryView[]
> {
  return [
    {
      attempts: 1,
      createdAtMs: nowMs - 420_000,
      id: 'b0000000-0000-4000-8000-000000000001',
      kind: 'incident_opened',
      monitorId: demoId('2'),
      status: 'sent',
      updatedAtMs: nowMs - 360_000,
    },
    {
      attempts: 1,
      createdAtMs: nowMs - 172_800_000,
      id: 'b0000000-0000-4000-8000-000000000002',
      kind: 'incident_resolved',
      monitorId: demoId('1'),
      status: 'sent',
      updatedAtMs: nowMs - 172_740_000,
    },
    {
      attempts: 2,
      createdAtMs: nowMs - 3_600_000,
      id: 'b0000000-0000-4000-8000-000000000003',
      kind: 'incident_opened',
      monitorId: demoId('4'),
      status: 'failed',
      updatedAtMs: nowMs - 3_000_000,
    },
  ]
}
