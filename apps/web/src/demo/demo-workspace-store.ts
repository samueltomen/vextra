import type { Preferences } from '@cronping/contracts'

import type { MonitorMetricsView } from '../features/monitoring/model/metrics-summary.ts'

export type DemoFolder = Readonly<{ id: string; name: string }>

let folders: DemoFolder[] = [
  { id: '30000000-0000-4000-8000-000000000001', name: 'Production' },
  { id: '30000000-0000-4000-8000-000000000002', name: 'Maintenance' },
]

let preferences: Preferences = {
  dashboardSort: 'priority',
  dashboardView: 'list',
  defaultFolderId: null,
  defaultGraceMinutes: 5,
  defaultIntervalMinutes: 60,
  density: 'compact',
  displayName: null,
  notifyOnOpen: true,
  notifyOnResolve: true,
  timeFormat: '24h',
  timezone: 'Europe/Paris',
}

export function listDemoFolders(): readonly DemoFolder[] {
  return folders.map((folder) => ({ ...folder }))
}

export function createDemoFolder(name: string): DemoFolder {
  const folder = { id: crypto.randomUUID(), name: name.trim() }

  folders = [...folders, folder].sort((left, right) =>
    left.name.localeCompare(right.name, 'fr'),
  )

  return folder
}

export function renameDemoFolder(folderId: string, name: string): void {
  folders = folders.map((folder) =>
    folder.id === folderId ? { ...folder, name: name.trim() } : folder,
  )
}

export function deleteDemoFolder(folderId: string): void {
  folders = folders.filter((folder) => folder.id !== folderId)
}

export function getDemoPreferences(): Preferences {
  return { ...preferences }
}

export function updateDemoPreferences(
  changes: Partial<Preferences>,
): Preferences {
  preferences = { ...preferences, ...changes }

  return { ...preferences }
}

export function getDemoMetrics(intervalMinutes: number): MonitorMetricsView {
  const nowMs = Date.now()
  const perDay = Math.max(1, Math.min(48, Math.round(1_440 / intervalMinutes)))
  const days = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(nowMs - (13 - index) * 86_400_000)
      .toISOString()
      .slice(0, 10)
    const pings = Math.max(1, perDay - (index % 4 === 0 ? 1 : 0))

    return {
      day,
      gapCount: pings,
      gapMaxSeconds: intervalMinutes * 60 + (index % 3) * 45,
      gapSumSeconds: pings * intervalMinutes * 60,
      pings,
    }
  })

  return {
    days,
    totalPings: days.reduce((sum, entry) => sum + entry.pings, 0),
  }
}

export function getDemoActivity(
  monitorIds: readonly string[],
): ReadonlyMap<string, readonly Readonly<{ day: string; pings: number }>[]> {
  const nowMs = Date.now()

  return new Map(
    monitorIds.map((monitorId, monitorIndex) => [
      monitorId,
      Array.from({ length: 14 }, (_, index) => ({
        day: new Date(nowMs - (13 - index) * 86_400_000)
          .toISOString()
          .slice(0, 10),
        pings:
          (index + monitorIndex * 3) % 7 === 0
            ? 0
            : 2 + ((index * 5 + monitorIndex) % 4),
      })),
    ]),
  )
}
