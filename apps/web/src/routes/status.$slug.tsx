import { createFileRoute } from '@tanstack/react-router'

import { PublicStatusPage } from '../features/status/ui/public-status-page.tsx'

export const Route = createFileRoute('/status/$slug')({
  component: PublicStatusPage,
})
