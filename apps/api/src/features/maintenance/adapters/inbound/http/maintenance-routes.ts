import {
  createMaintenanceRequestSchema,
  monitorIdSchema,
} from '@vextra/contracts'
import { Hono, type Context } from 'hono'

import {
  MaintenanceLimitError,
  MaintenanceMonitorNotFoundError,
  type ManageMaintenance,
} from '../../../application/maintenance.ts'

export type MaintenanceScope = Readonly<{
  maintenance: Pick<ManageMaintenance, 'create' | 'list' | 'remove'>
  tenantId: string
}>

export type MaintenanceRoutesDependencies = Readonly<{
  authenticate: (context: Context) => Promise<MaintenanceScope | null>
}>

function errorBody(
  context: Context,
  status: 400 | 401 | 404 | 409 | 422 | 500,
  code: string,
  message: string,
) {
  return context.json({ error: { code, message } }, status)
}

export function createMaintenanceRoutes(
  dependencies: MaintenanceRoutesDependencies,
): Hono {
  const routes = new Hono()

  async function withScope(
    context: Context,
    handler: (scope: MaintenanceScope) => Promise<Response>,
  ): Promise<Response> {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return errorBody(context, 401, 'unauthorized', 'Authentication required')
    }

    try {
      return await handler(scope)
    } catch (error) {
      if (error instanceof MaintenanceLimitError) {
        return errorBody(context, 409, 'limit_reached', 'Too many windows')
      }

      if (error instanceof MaintenanceMonitorNotFoundError) {
        return errorBody(context, 404, 'monitor_not_found', 'Monitor not found')
      }

      return errorBody(context, 500, 'internal_error', 'Request failed')
    }
  }

  routes.get('/api/maintenance', (context) =>
    withScope(context, async (scope) =>
      context.json({
        data: { windows: await scope.maintenance.list(scope.tenantId) },
      }),
    ),
  )

  routes.post('/api/maintenance', (context) =>
    withScope(context, async (scope) => {
      let body: unknown

      try {
        body = await context.req.json()
      } catch {
        return errorBody(
          context,
          400,
          'invalid_json',
          'Request body must be valid JSON',
        )
      }

      const parsed = createMaintenanceRequestSchema.safeParse(body)

      if (!parsed.success) {
        return errorBody(
          context,
          422,
          'validation_failed',
          'The maintenance window is invalid',
        )
      }

      return context.json(
        { data: await scope.maintenance.create(scope.tenantId, parsed.data) },
        201,
      )
    }),
  )

  routes.delete('/api/maintenance/:windowId', (context) =>
    withScope(context, async (scope) => {
      const windowId = monitorIdSchema.safeParse(context.req.param('windowId'))

      if (!windowId.success) {
        return errorBody(context, 404, 'not_found', 'Window not found')
      }

      return (await scope.maintenance.remove(scope.tenantId, windowId.data))
        ? context.body(null, 204)
        : errorBody(context, 404, 'not_found', 'Window not found')
    }),
  )

  return routes
}
