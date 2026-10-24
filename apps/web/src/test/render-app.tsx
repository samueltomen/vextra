import { HeroUIProvider } from '@heroui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'

import { routeTree } from '../routeTree.gen.ts'

export async function renderApp(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  const router = createRouter({
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    routeTree,
  })

  await router.load()

  return render(
    <HeroUIProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </HeroUIProvider>,
  )
}
