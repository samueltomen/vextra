import type {
  CreateMonitorResponse,
  ListMonitorIncidentsResponse,
  ListMonitorsResponse,
  MonitorResponse,
  RotateMonitorTokenResponse,
} from '@vextra/contracts'

import { ApiError, apiRequest } from '../../../api/client.ts'
import {
  createDemoMonitor,
  deleteDemoMonitor,
  getDemoMonitor,
  listDemoIncidents,
  listDemoMonitors,
  pauseDemoMonitor,
  renameDemoMonitor,
  resumeDemoMonitor,
  rotateDemoMonitorToken,
  updateDemoMonitorDetails,
  updateDemoMonitorSchedule,
} from '../../../demo/demo-monitoring-store.ts'
import { isDemoModeEnabled } from '../../../demo/demo-mode.ts'
import {
  getLocalMonitorLabel,
  getLocalMonitorLabels,
  saveLocalMonitorLabel,
} from '../model/local-labels.ts'
import type { MonitorView } from '../model/monitor.ts'

export type CronScheduleDraft = Readonly<{
  expression: string
  timezone: string
}>

export type CreateMonitorDraft = Readonly<{
  cron?: CronScheduleDraft | undefined
  graceMinutes: number
  intervalMinutes: number
  localLabel: string
}>

export type CreatedMonitor = Readonly<{
  heartbeatToken: string
  monitor: MonitorView
}>

export type MonitorIncidentView = Readonly<{
  id: string
  reason: 'heartbeat_missed' | 'run_failed'
  openedAtMs: number
  resolutionReason: 'heartbeat_received' | 'manual' | null
  resolvedAtMs: number | null
}>

function toMonitorView(
  monitor: ListMonitorsResponse['data']['monitors'][number],
  localLabel: string,
): MonitorView {
  return {
    alertAtMs: Date.parse(monitor.alertAt),
    alertsEnabled: monitor.alertsEnabled,
    createdAtMs: Date.parse(monitor.createdAt),
    cronExpression: monitor.cronExpression,
    cronTimezone: monitor.cronTimezone,
    description: monitor.description,
    folderId: monitor.folderId,
    graceMinutes: Math.round(monitor.graceSeconds / 60),
    id: monitor.id,
    incidentOpenedAtMs:
      monitor.incidentOpenedAt === null
        ? null
        : Date.parse(monitor.incidentOpenedAt),
    intervalMinutes: Math.round(monitor.intervalSeconds / 60),
    lastHeartbeatAtMs:
      monitor.lastHeartbeatAt === null
        ? null
        : Date.parse(monitor.lastHeartbeatAt),
    localLabel: monitor.name ?? localLabel,
    notes: monitor.notes,
    runningSinceMs:
      monitor.runningSince === null ? null : Date.parse(monitor.runningSince),
    serverName: monitor.name,
    status: monitor.status,
    tags: monitor.tags,
    totalPings: monitor.totalPings,
  }
}

function scheduleBody(
  draft: Readonly<{
    cron?: CronScheduleDraft | undefined
    graceMinutes: number
    intervalMinutes: number
  }>,
) {
  const graceSeconds = Math.round(draft.graceMinutes * 60)

  return draft.cron
    ? {
        cron: draft.cron.expression.trim(),
        graceSeconds,
        timezone: draft.cron.timezone,
      }
    : { graceSeconds, intervalSeconds: Math.round(draft.intervalMinutes * 60) }
}

function fallbackLabel(monitorId: string): string {
  return `Moniteur ${monitorId.slice(0, 8)}`
}

export async function listMonitors(): Promise<readonly MonitorView[]> {
  if (isDemoModeEnabled()) {
    return listDemoMonitors()
  }

  const response = await apiRequest<ListMonitorsResponse>('/api/monitors')
  const labels = getLocalMonitorLabels()

  return response.data.monitors.map((monitor) =>
    toMonitorView(monitor, labels[monitor.id] ?? fallbackLabel(monitor.id)),
  )
}

export async function getMonitor(
  monitorId: string,
): Promise<MonitorView | null> {
  if (isDemoModeEnabled()) {
    return getDemoMonitor(monitorId)
  }

  try {
    const response = await apiRequest<MonitorResponse>(
      `/api/monitors/${encodeURIComponent(monitorId)}`,
    )

    return toMonitorView(
      response.data.monitor,
      getLocalMonitorLabel(monitorId) ?? fallbackLabel(monitorId),
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }

    throw error
  }
}

export async function createMonitor(
  draft: CreateMonitorDraft,
): Promise<CreatedMonitor> {
  if (isDemoModeEnabled()) {
    return createDemoMonitor(draft)
  }

  const response = await apiRequest<CreateMonitorResponse>('/api/monitors', {
    body: JSON.stringify(scheduleBody(draft)),
    method: 'POST',
  })
  const nowMs = Date.now()

  saveLocalMonitorLabel(response.data.id, draft.localLabel)

  if (draft.localLabel.trim().length > 0) {
    // Best effort: the name is only a convenience, the monitor already exists.
    await updateMonitorDetails(response.data.id, {
      name: draft.localLabel.trim(),
    }).catch(() => undefined)
  }

  return {
    heartbeatToken: response.data.heartbeatToken,
    monitor: {
      alertAtMs: Date.parse(response.data.alertAt),
      alertsEnabled: true,
      createdAtMs: nowMs,
      cronExpression: draft.cron?.expression ?? null,
      cronTimezone: draft.cron?.timezone ?? null,
      description: null,
      folderId: null,
      graceMinutes: draft.graceMinutes,
      id: response.data.id,
      incidentOpenedAtMs: null,
      intervalMinutes: draft.intervalMinutes,
      lastHeartbeatAtMs: null,
      localLabel: draft.localLabel.trim(),
      notes: null,
      runningSinceMs: null,
      serverName: draft.localLabel.trim() || null,
      status: response.data.status,
      tags: [],
      totalPings: 0,
    },
  }
}

export async function renameMonitor(
  monitorId: string,
  label: string,
): Promise<void> {
  if (isDemoModeEnabled()) {
    return renameDemoMonitor(monitorId, label)
  }

  saveLocalMonitorLabel(monitorId, label)
  await updateMonitorDetails(monitorId, { name: label.trim() || null })
}

export type MonitorDetailsChanges = Readonly<{
  alertsEnabled?: boolean
  description?: string | null
  name?: string | null
  notes?: string | null
  tags?: readonly string[]
}>

export async function updateMonitorDetails(
  monitorId: string,
  changes: MonitorDetailsChanges,
): Promise<void> {
  if (isDemoModeEnabled()) {
    return updateDemoMonitorDetails(monitorId, changes)
  }

  await apiRequest(`/api/monitors/${encodeURIComponent(monitorId)}/details`, {
    body: JSON.stringify(changes),
    method: 'PATCH',
  })
}

export type MonitorScheduleDraft = Readonly<{
  cron?: CronScheduleDraft | undefined
  graceMinutes: number
  intervalMinutes: number
}>

export async function updateMonitorSchedule(
  monitorId: string,
  draft: MonitorScheduleDraft,
): Promise<void> {
  if (isDemoModeEnabled()) {
    return updateDemoMonitorSchedule(monitorId, draft)
  }

  await apiRequest<MonitorResponse>(
    `/api/monitors/${encodeURIComponent(monitorId)}`,
    {
      body: JSON.stringify(scheduleBody(draft)),
      method: 'PATCH',
    },
  )
}

export async function pauseMonitor(monitorId: string): Promise<void> {
  if (isDemoModeEnabled()) {
    return pauseDemoMonitor(monitorId)
  }

  await apiRequest<void>(
    `/api/monitors/${encodeURIComponent(monitorId)}/pause`,
    { method: 'POST' },
  )
}

export async function resumeMonitor(monitorId: string): Promise<void> {
  if (isDemoModeEnabled()) {
    return resumeDemoMonitor(monitorId)
  }

  await apiRequest<void>(
    `/api/monitors/${encodeURIComponent(monitorId)}/resume`,
    { method: 'POST' },
  )
}

export async function deleteMonitor(monitorId: string): Promise<void> {
  if (isDemoModeEnabled()) {
    return deleteDemoMonitor(monitorId)
  }

  await apiRequest<void>(`/api/monitors/${encodeURIComponent(monitorId)}`, {
    method: 'DELETE',
  })
}

export async function listMonitorIncidents(
  monitorId: string,
): Promise<readonly MonitorIncidentView[]> {
  if (isDemoModeEnabled()) {
    return listDemoIncidents(monitorId)
  }

  const response = await apiRequest<ListMonitorIncidentsResponse>(
    `/api/monitors/${encodeURIComponent(monitorId)}/incidents`,
  )

  return response.data.incidents.map((incident) => ({
    id: incident.id,
    openedAtMs: Date.parse(incident.openedAt),
    reason: incident.reason,
    resolutionReason: incident.resolutionReason,
    resolvedAtMs:
      incident.resolvedAt === null ? null : Date.parse(incident.resolvedAt),
  }))
}

export async function rotateMonitorToken(monitorId: string): Promise<string> {
  if (isDemoModeEnabled()) {
    const token = await rotateDemoMonitorToken(monitorId)

    if (!token) {
      throw new Error('Monitor not found')
    }

    return token
  }

  const response = await apiRequest<RotateMonitorTokenResponse>(
    `/api/monitors/${encodeURIComponent(monitorId)}/rotate-token`,
    { method: 'POST' },
  )

  return response.data.heartbeatToken
}
