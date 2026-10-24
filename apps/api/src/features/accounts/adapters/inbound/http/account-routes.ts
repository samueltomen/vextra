import { Hono, type Context } from 'hono'

import type { DeleteAccount } from '../../../application/delete-account.ts'
import { clearSessionCookie } from './session-cookies.ts'

export type AccountRoutesDependencies = Readonly<{
  authenticate: (context: Context) => Promise<Readonly<{
    deleteAccount: Pick<DeleteAccount, 'execute'>
    userId: string
  }> | null>
}>

export function createAccountRoutes(
  dependencies: AccountRoutesDependencies,
): Hono {
  const routes = new Hono()

  routes.delete('/api/account', async (context) => {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return context.json(
        {
          error: {
            code: 'unauthorized',
            message: 'Authentication required',
          },
        },
        401,
      )
    }

    try {
      await scope.deleteAccount.execute(scope.userId)
      clearSessionCookie(context)

      return context.body(null, 204)
    } catch {
      return context.json(
        {
          error: {
            code: 'internal_error',
            message: 'An unexpected error occurred',
          },
        },
        500,
      )
    }
  })

  return routes
}
