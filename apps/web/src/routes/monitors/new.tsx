import { createFileRoute } from '@tanstack/react-router'

import { CreateMonitorPage } from '../../features/monitoring/ui/create-monitor-page.tsx'

export const Route = createFileRoute('/monitors/new')({
  component: CreateMonitorPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { grace?: number; interval?: number; name?: string } => {
    const grace = Number(search['grace'])
    const interval = Number(search['interval'])

    return {
      ...(Number.isFinite(grace) && search['grace'] !== undefined
        ? { grace }
        : {}),
      ...(Number.isFinite(interval) && search['interval'] !== undefined
        ? { interval }
        : {}),
      ...(typeof search['name'] === 'string' ? { name: search['name'] } : {}),
    }
  },
})
