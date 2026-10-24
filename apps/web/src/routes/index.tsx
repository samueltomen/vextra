import { createFileRoute } from '@tanstack/react-router'

import { DashboardPage } from '../features/monitoring/ui/dashboard-page.tsx'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})
