import { Hono, type Context } from 'hono'

import type { NotificationHistory } from '../../../application/notification-history.ts'

export type NotificationRoutesDependencies = Readonly<{
  authenticate: (context: Context) => Promise<Readonly<{
    history: Pick<NotificationHistory, 'list'>
    tenantId: string
  }> | null>
}>

export function createNotificationRoutes(
  dependencies: NotificationRoutesDependencies,
): Hono {
  const routes = new Hono()

  routes.get('/api/notifications', async (context) => {
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
      const deliveries = await scope.history.list(scope.tenantId)

      return context.json({
        data: {
          deliveries: deliveries.map((delivery) => ({
            attempts: delivery.attempts,
            createdAt: new Date(delivery.createdAtMs).toISOString(),
            id: delivery.id,
            kind: delivery.kind,
            monitorId: delivery.monitorId,
            status: delivery.status,
            updatedAt: new Date(delivery.updatedAtMs).toISOString(),
          })),
        },
      })
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
