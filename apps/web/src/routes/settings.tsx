import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '../features/accounts/ui/settings-page.tsx'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})
