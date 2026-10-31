import type { ListNotificationsResponse } from '@vextra/contracts'

import { apiRequest } from '../../../api/client.ts'
import { isDemoModeEnabled } from '../../../demo/demo-mode.ts'
import { listDemoNotifications } from '../../../demo/demo-monitoring-store.ts'

export type NotificationDeliveryView = Readonly<{
  attempts: number
  createdAtMs: number
  id: string
  kind: 'incident_opened' | 'incident_resolved' | 'run_failed'
  monitorId: string
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'dead' | 'skipped'
  updatedAtMs: number
}>

export async function listNotifications(): Promise<
  readonly NotificationDeliveryView[]
> {
  if (isDemoModeEnabled()) {
    return listDemoNotifications()
  }

  const response =
    await apiRequest<ListNotificationsResponse>('/api/notifications')

  return response.data.deliveries.map((delivery) => ({
    attempts: delivery.attempts,
    createdAtMs: Date.parse(delivery.createdAt),
    id: delivery.id,
    kind: delivery.kind,
    monitorId: delivery.monitorId,
    status: delivery.status,
    updatedAtMs: Date.parse(delivery.updatedAt),
  }))
}
