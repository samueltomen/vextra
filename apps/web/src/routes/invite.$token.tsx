import { createFileRoute } from '@tanstack/react-router'

import { InvitePage } from '../features/team/ui/invite-page.tsx'

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
})
