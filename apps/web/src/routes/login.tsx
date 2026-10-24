import { createFileRoute } from '@tanstack/react-router'

import { LoginPage } from '../features/accounts/ui/login-page.tsx'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})
