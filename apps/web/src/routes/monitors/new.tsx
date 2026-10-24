import { createFileRoute } from '@tanstack/react-router'

import { CreateMonitorPage } from '../../features/monitoring/ui/create-monitor-page.tsx'

export const Route = createFileRoute('/monitors/new')({
  component: CreateMonitorPage,
})
