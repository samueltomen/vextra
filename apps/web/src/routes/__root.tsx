import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext } from '@tanstack/react-router'

import { AppShell } from '../shell/app-shell.tsx'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: AppShell,
  notFoundComponent: () => (
    <div className="rounded-xl border border-line bg-surface p-8 text-center">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <p className="mt-2 text-muted">
        Revenez au dashboard pour retrouver vos moniteurs.
      </p>
    </div>
  ),
})
