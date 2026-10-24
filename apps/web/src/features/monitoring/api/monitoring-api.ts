import type {
  CreateMonitorResponse,
  ListMonitorIncidentsResponse,
  ListMonitorsResponse,
  MonitorResponse,
} from '@cronping/contracts'

import { ApiError, apiRequest } from '../../../api/client.ts'
import {
  createDemoMonitor,
  deleteDemoMonitor,
  getDemoMonitor,
  listDemoIncidents,
  listDemoMonitors,
  pauseDemoMonitor,
  resumeDemoMonitor,
} from '../../../demo/demo-monitoring-store.ts'
import { isDemoModeEnabled } from '../../../demo/demo-mode.ts'
import {
  getLocalMonitorLabel,
  getLocalMonitorLabels,
  saveLocalMonitorLabel,
} from '../model/local-labels.ts'
import type { MonitorView } from '../model/monitor.ts'

export type CreateMonitorDraft = Readonly<{
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
    createdAtMs: Date.parse(monitor.createdAt),
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
    localLabel,
    status: monitor.status,
  }
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
    body: JSON.stringify({
      graceSeconds: Math.round(draft.graceMinutes * 60),
      intervalSeconds: Math.round(draft.intervalMinutes * 60),
    }),
    method: 'POST',
  })
  const nowMs = Date.now()

  saveLocalMonitorLabel(response.data.id, draft.localLabel)

  return {
    heartbeatToken: response.data.heartbeatToken,
    monitor: {
      alertAtMs: Date.parse(response.data.alertAt),
      createdAtMs: nowMs,
      graceMinutes: draft.graceMinutes,
      id: response.data.id,
      incidentOpenedAtMs: null,
      intervalMinutes: draft.intervalMinutes,
      lastHeartbeatAtMs: null,
      localLabel: draft.localLabel.trim(),
      status: response.data.status,
    },
  }
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
    resolutionReason: incident.resolutionReason,
    resolvedAtMs:
      incident.resolvedAt === null ? null : Date.parse(incident.resolvedAt),
  }))
}
