import { createFileRoute } from '@tanstack/react-router'

import { MonitorDetailPage } from '../../features/monitoring/ui/monitor-detail-page.tsx'

export const Route = createFileRoute('/monitors/$monitorId')({
  component: MonitorDetailRoute,
})

function MonitorDetailRoute() {
  const { monitorId } = Route.useParams()

  return <MonitorDetailPage monitorId={monitorId} />
}
