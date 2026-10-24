import type { MonitorStatus } from './monitor.ts'

const MINUTE_MS = 60_000

export function formatFrequency(minutes: number): string {
  if (minutes % 10_080 === 0) {
    return minutes === 10_080
      ? 'Toutes les semaines'
      : `Toutes les ${minutes / 10_080} semaines`
  }
  if (minutes % 1_440 === 0) {
    return minutes === 1_440
      ? 'Tous les jours'
      : `Tous les ${minutes / 1_440} jours`
  }
  if (minutes % 60 === 0) {
    return minutes === 60
      ? 'Toutes les heures'
      : `Toutes les ${minutes / 60} heures`
  }
  return `Toutes les ${minutes} minutes`
}

export function formatDateTime(timestampMs: number | null): string {
  if (timestampMs === null) {
    return 'Aucun heartbeat reçu'
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestampMs)
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
