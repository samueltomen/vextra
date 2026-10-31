import type {
  PublicStatusPage,
  PublicStatusPageResponse,
  SaveStatusPageRequest,
  StatusPageResponse,
} from '@vextra/contracts'

import { ApiError, apiRequest } from '../../../api/client.ts'
import { isDemoModeEnabled } from '../../../demo/demo-mode.ts'

export type StatusPageSettingsView = StatusPageResponse['data']

let demoSettings: StatusPageSettingsView = { monitorIds: [], page: null }

const DEMO_PUBLIC_PAGE: PublicStatusPage = {
  description: 'Exemple de page de statut en mode démonstration.',
  generatedAt: new Date().toISOString(),
  incidents: [],
  monitors: [
    { name: 'API publique', status: 'healthy', uptime30d: 99.98 },
    { name: 'Sauvegarde PostgreSQL', status: 'healthy', uptime30d: 100 },
  ],
  title: 'Statut de démonstration',
}

export async function getStatusPageSettings(): Promise<StatusPageSettingsView> {
  if (isDemoModeEnabled()) {
    return demoSettings
  }

  return (await apiRequest<StatusPageResponse>('/api/status-page')).data
}

export async function saveStatusPage(
  request: SaveStatusPageRequest,
): Promise<StatusPageSettingsView> {
  if (isDemoModeEnabled()) {
    demoSettings = {
      monitorIds: [...request.monitorIds],
      page: {
        description: request.description,
        enabled: request.enabled,
        slug: request.slug,
        title: request.title,
      },
    }

    return demoSettings
  }

  return (
    await apiRequest<StatusPageResponse>('/api/status-page', {
      body: JSON.stringify(request),
      method: 'PUT',
    })
  ).data
}

/** Returns `null` when the page does not exist or is not published. */
export async function getPublicStatusPage(
  slug: string,
): Promise<PublicStatusPage | null> {
  if (isDemoModeEnabled()) {
    return slug === 'demo' ? DEMO_PUBLIC_PAGE : null
  }

  try {
    return (
      await apiRequest<PublicStatusPageResponse>(
        `/api/status/${encodeURIComponent(slug)}`,
      )
    ).data
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }

    throw error
  }
}
