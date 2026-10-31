import type { Preferences, UpdatePreferencesRequest } from '@cronping/contracts'

import { apiRequest } from '../../../api/client.ts'
import { isDemoModeEnabled } from '../../../demo/demo-mode.ts'
import { setDemoMonitorFolder } from '../../../demo/demo-monitoring-store.ts'
import {
  createDemoFolder,
  deleteDemoFolder,
  getDemoMetrics,
  getDemoPreferences,
  listDemoFolders,
  renameDemoFolder,
  updateDemoPreferences,
} from '../../../demo/demo-workspace-store.ts'
import type { MonitorMetricsView } from '../../monitoring/model/metrics-summary.ts'

export type FolderView = Readonly<{ id: string; name: string }>

export async function listFolders(): Promise<readonly FolderView[]> {
  if (isDemoModeEnabled()) {
    return listDemoFolders()
  }

  const response = await apiRequest<{ data: { folders: FolderView[] } }>(
    '/api/folders',
  )

  return response.data.folders
}

export async function createFolder(name: string): Promise<FolderView> {
  if (isDemoModeEnabled()) {
    return createDemoFolder(name)
  }

  const response = await apiRequest<{ data: { folder: FolderView } }>(
    '/api/folders',
    { body: JSON.stringify({ name }), method: 'POST' },
  )

  return response.data.folder
}

export async function renameFolder(
  folderId: string,
  name: string,
): Promise<void> {
  if (isDemoModeEnabled()) {
    renameDemoFolder(folderId, name)

    return
  }

  await apiRequest(`/api/folders/${encodeURIComponent(folderId)}`, {
    body: JSON.stringify({ name }),
    method: 'PATCH',
  })
}

export async function deleteFolder(folderId: string): Promise<void> {
  if (isDemoModeEnabled()) {
    deleteDemoFolder(folderId)

    return
  }

  await apiRequest(`/api/folders/${encodeURIComponent(folderId)}`, {
    method: 'DELETE',
  })
}

export async function setMonitorFolder(
  monitorId: string,
  folderId: string | null,
): Promise<void> {
  if (isDemoModeEnabled()) {
    setDemoMonitorFolder(monitorId, folderId)

    return
  }

  await apiRequest(`/api/monitors/${encodeURIComponent(monitorId)}/folder`, {
    body: JSON.stringify({ folderId }),
    method: 'PUT',
  })
}

export async function getPreferences(): Promise<Preferences> {
  if (isDemoModeEnabled()) {
    return getDemoPreferences()
  }

  const response = await apiRequest<{ data: { preferences: Preferences } }>(
    '/api/preferences',
  )

  return response.data.preferences
}

export async function updatePreferences(
  changes: UpdatePreferencesRequest,
): Promise<Preferences> {
  if (isDemoModeEnabled()) {
    return updateDemoPreferences(changes as Partial<Preferences>)
  }

  const response = await apiRequest<{ data: { preferences: Preferences } }>(
    '/api/preferences',
    { body: JSON.stringify(changes), method: 'PATCH' },
  )

  return response.data.preferences
}

export async function getMonitorMetrics(
  monitorId: string,
  intervalMinutes: number,
): Promise<MonitorMetricsView> {
  if (isDemoModeEnabled()) {
    return getDemoMetrics(intervalMinutes)
  }

  const response = await apiRequest<{ data: MonitorMetricsView }>(
    `/api/monitors/${encodeURIComponent(monitorId)}/metrics`,
  )

  return response.data
}
