import type { MonitorView } from './monitor.ts'

export type DueProgress = Readonly<{
  fraction: number
  overdue: boolean
}>

export function getDueProgress(
  monitor: Pick<
    MonitorView,
    'alertAtMs' | 'createdAtMs' | 'lastHeartbeatAtMs' | 'status'
  >,
  nowMs: number,
): DueProgress | null {
  if (monitor.status === 'paused') {
    return null
  }

  if (nowMs >= monitor.alertAtMs) {
    return { fraction: 1, overdue: true }
  }

  const startMs = monitor.lastHeartbeatAtMs ?? monitor.createdAtMs
  const spanMs = monitor.alertAtMs - startMs

  if (spanMs <= 0) {
    return { fraction: 1, overdue: false }
  }

  return {
    fraction: Math.min(1, Math.max(0, (nowMs - startMs) / spanMs)),
    overdue: false,
  }
}

/**
 * The server flags a monitor as late on its next one-minute check. Until then
 * the interface already shows an overdue active monitor as late.
 */
export function withEffectiveStatus(
  monitor: MonitorView,
  nowMs: number,
): MonitorView {
  const overdue =
    (monitor.status === 'healthy' || monitor.status === 'pending') &&
    nowMs >= monitor.alertAtMs

  return overdue ? { ...monitor, status: 'late' } : monitor
}

export type MonitorSort = 'name' | 'priority' | 'recent' | 'signal'

const STATUS_RANK = { late: 0, pending: 1, healthy: 2, paused: 3 } as const

export function sortMonitors(
  monitors: readonly MonitorView[],
  sort: MonitorSort,
): readonly MonitorView[] {
  const sorted = [...monitors]

  switch (sort) {
    case 'name':
      return sorted.sort((left, right) =>
        left.localLabel.localeCompare(right.localLabel, 'fr', {
          sensitivity: 'base',
        }),
      )
    case 'recent':
      return sorted.sort((left, right) => right.createdAtMs - left.createdAtMs)
    case 'signal':
      return sorted.sort(
        (left, right) =>
          (right.lastHeartbeatAtMs ?? Number.NEGATIVE_INFINITY) -
          (left.lastHeartbeatAtMs ?? Number.NEGATIVE_INFINITY),
      )
    case 'priority':
      return sorted.sort(
        (left, right) =>
          STATUS_RANK[left.status] - STATUS_RANK[right.status] ||
          left.alertAtMs - right.alertAtMs,
      )
  }
}
