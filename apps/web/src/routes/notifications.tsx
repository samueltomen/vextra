import { createFileRoute } from '@tanstack/react-router'

import { NotificationsPage } from '../features/notifications/ui/notifications-page.tsx'

export const Route = createFileRoute('/notifications')({
  component: NotificationsPage,
})
