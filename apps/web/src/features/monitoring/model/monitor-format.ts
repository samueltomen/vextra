import type { MonitorStatus } from './monitor.ts'

const MINUTE_MS = 60_000

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
