import type { MonitorStatus, MonitorView } from '../model/monitor.ts'

export type CreateMonitorDraft = Readonly<{
  localLabel: string
  intervalMinutes: number
  graceMinutes: number
  channel: MonitorView['channel']
}>

export type CreatedMonitor = Readonly<{
  monitor: MonitorView
  heartbeatToken: string
}>

const MINUTE_MS = 60_000

function createSeedMonitors(nowMs: number): MonitorView[] {
  return [
    {
      id: 'backup-postgres',
      tenantId: 'local-preview',
      localLabel: 'Sauvegarde PostgreSQL',
      intervalMinutes: 1_440,
      graceMinutes: 30,
      status: 'healthy',
      lastHeartbeatAtMs: nowMs - 42 * MINUTE_MS,
      alertAtMs: nowMs + 23 * 60 * MINUTE_MS,
      channel: 'email',
    },
    {
      id: 'sync-stripe',
      tenantId: 'local-preview',
      localLabel: 'Synchronisation Stripe',
      intervalMinutes: 15,
      graceMinutes: 3,
      status: 'late',
      lastHeartbeatAtMs: nowMs - 24 * MINUTE_MS,
      alertAtMs: nowMs - 6 * MINUTE_MS,
      channel: 'discord',
    },
    {
      id: 'weekly-report',
      tenantId: 'local-preview',
      localLabel: 'Rapport hebdomadaire',
      intervalMinutes: 10_080,
      graceMinutes: 120,
      status: 'paused',
      lastHeartbeatAtMs: nowMs - 3 * 24 * 60 * MINUTE_MS,
      alertAtMs: nowMs + 4 * 24 * 60 * MINUTE_MS,
      channel: 'email',
    },
    {
      id: 'media-cleanup',
      tenantId: 'local-preview',
      localLabel: 'Nettoyage des médias',
      intervalMinutes: 360,
      graceMinutes: 20,
      status: 'pending',
      lastHeartbeatAtMs: null,
      alertAtMs: nowMs + 6 * 60 * MINUTE_MS,
      channel: 'discord',
    },
  ]
}

const monitors = createSeedMonitors(Date.now())

function waitForPreview(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 180))
}

export async function listMonitors(): Promise<readonly MonitorView[]> {
  await waitForPreview()
  return [...monitors]
}

export async function getMonitor(
  monitorId: string,
): Promise<MonitorView | null> {
  await waitForPreview()
  return monitors.find((monitor) => monitor.id === monitorId) ?? null
}

export async function createMockMonitor(
  draft: CreateMonitorDraft,
): Promise<CreatedMonitor> {
  await waitForPreview()

  const nowMs = Date.now()
  const monitor: MonitorView = {
    id: `monitor-${crypto.randomUUID()}`,
    tenantId: 'local-preview',
    localLabel: draft.localLabel.trim(),
    intervalMinutes: draft.intervalMinutes,
    graceMinutes: draft.graceMinutes,
    status: 'pending',
    lastHeartbeatAtMs: null,
    alertAtMs: nowMs + (draft.intervalMinutes + draft.graceMinutes) * MINUTE_MS,
    channel: draft.channel,
  }

  monitors.unshift(monitor)

  return {
    monitor,
    heartbeatToken: `cp_${crypto.randomUUID().replaceAll('-', '')}`,
  }
}

export function formatRelativeTime(timestampMs: number | null): string {
  if (timestampMs === null) {
    return 'Aucun heartbeat'
  }

  const deltaMinutes = Math.round((timestampMs - Date.now()) / MINUTE_MS)
  const formatter = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

  if (Math.abs(deltaMinutes) < 60) {
    return formatter.format(deltaMinutes, 'minute')
  }

  const deltaHours = Math.round(deltaMinutes / 60)
  if (Math.abs(deltaHours) < 48) {
    return formatter.format(deltaHours, 'hour')
  }

  return formatter.format(Math.round(deltaHours / 24), 'day')
}

export function statusLabel(status: MonitorStatus): string {
  return {
    healthy: 'Opérationnel',
    late: 'En retard',
    paused: 'En pause',
    pending: 'En attente',
  }[status]
}
