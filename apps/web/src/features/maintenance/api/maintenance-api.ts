import type {
  CreateMaintenanceRequest,
  ListMaintenanceResponse,
  MaintenanceWindow,
} from '@vextra/contracts'

import { apiRequest } from '../../../api/client.ts'
import { isDemoModeEnabled } from '../../../demo/demo-mode.ts'

let demoWindows: MaintenanceWindow[] = []

export async function listMaintenance(): Promise<readonly MaintenanceWindow[]> {
  if (isDemoModeEnabled()) {
    return demoWindows
  }

  return (await apiRequest<ListMaintenanceResponse>('/api/maintenance')).data
    .windows
}

export async function createMaintenance(
  request: CreateMaintenanceRequest,
): Promise<MaintenanceWindow> {
  if (isDemoModeEnabled()) {
    const created = { ...request, id: crypto.randomUUID() }

    demoWindows = [...demoWindows, created]

    return created
  }

  return (
    await apiRequest<{ data: MaintenanceWindow }>('/api/maintenance', {
      body: JSON.stringify(request),
      method: 'POST',
    })
  ).data
}

export async function deleteMaintenance(windowId: string): Promise<void> {
  if (isDemoModeEnabled()) {
    demoWindows = demoWindows.filter((window) => window.id !== windowId)

    return
  }

  await apiRequest<void>(`/api/maintenance/${encodeURIComponent(windowId)}`, {
    method: 'DELETE',
  })
}
