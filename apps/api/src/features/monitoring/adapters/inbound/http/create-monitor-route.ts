import { createMonitorRequestSchema } from '@cronping/contracts'
import { Hono, type Context } from 'hono'

import type { CreateMonitor } from '../../../application/create-monitor.ts'

export type AuthenticatedPrincipal = Readonly<{
  tenantId: string
  userId: string
}>

export type AuthenticatedMonitorScope = Readonly<{
  createMonitor: Pick<CreateMonitor, 'execute'>
  principal: AuthenticatedPrincipal
}>

export type CreateMonitorRoutesDependencies = Readonly<{
  authenticate: (context: Context) => Promise<AuthenticatedMonitorScope | null>
}>

export function createMonitorRoutes(
  dependencies: CreateMonitorRoutesDependencies,
): Hono {
  const routes = new Hono()

  routes.post('/api/monitors', async (context) => {
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

    let body: unknown

    try {
      body = await context.req.json()
    } catch {
      return context.json(
        {
          error: {
            code: 'invalid_json',
            message: 'Request body must be valid JSON',
          },
        },
        400,
      )
    }

    const parsed = createMonitorRequestSchema.safeParse(body)

    if (!parsed.success) {
      return context.json(
        {
          error: {
            code: 'validation_error',
            message: 'Request validation failed',
            details: parsed.error.issues.map((issue) => ({
              code: issue.code,
              field: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        422,
      )
    }

    try {
      const result = await scope.createMonitor.execute({
        tenantId: scope.principal.tenantId,
        intervalSeconds: parsed.data.intervalSeconds,
        graceSeconds: parsed.data.graceSeconds,
      })

      return context.json(
        {
          data: {
            id: result.monitor.id,
            intervalSeconds: result.monitor.intervalSeconds,
            graceSeconds: result.monitor.graceSeconds,
            status: result.monitor.status,
            alertAt: new Date(result.monitor.alertAtMs).toISOString(),
            heartbeatToken: result.heartbeatToken,
          },
        },
        201,
        {
          Location: `/api/monitors/${result.monitor.id}`,
        },
      )
    } catch (error) {
      if (error instanceof RangeError) {
        return context.json(
          {
            error: {
              code: 'validation_error',
              message: 'Request validation failed',
            },
          },
          422,
        )
      }

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
