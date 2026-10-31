import { createApiKeyRequestSchema, monitorIdSchema } from '@vextra/contracts'
import { Hono, type Context } from 'hono'

import { toMonitorResponse } from '../../../../monitoring/adapters/inbound/http/monitor-routes.ts'
import type { MonitorReadService } from '../../../../monitoring/application/monitor-read.ts'
import {
  ApiKeyLimitError,
  type AuthenticateApiKey,
  type ManageApiKeys,
} from '../../../application/api-keys.ts'

export type ApiKeyScope = Readonly<{
  keys: Pick<ManageApiKeys, 'create' | 'list' | 'revoke'>
  tenantId: string
}>

export type ApiKeyRoutesDependencies = Readonly<{
  authenticate: (context: Context) => Promise<ApiKeyScope | null>
  authenticator: Pick<AuthenticateApiKey, 'tenantFor'>
  monitors: Pick<MonitorReadService, 'get' | 'list'>
}>

function errorBody(
  context: Context,
  status: 400 | 401 | 404 | 409 | 422 | 500,
  code: string,
  message: string,
) {
  return context.json({ error: { code, message } }, status)
}

function readBearer(context: Context): string | null {
  const header = context.req.header('authorization')
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null

  return match?.[1] ?? null
}

export function createApiKeyRoutes(
  dependencies: ApiKeyRoutesDependencies,
): Hono {
  const routes = new Hono()

  async function withSession(
    context: Context,
    handler: (scope: ApiKeyScope) => Promise<Response>,
  ): Promise<Response> {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return errorBody(context, 401, 'unauthorized', 'Authentication required')
    }

    try {
      return await handler(scope)
    } catch (error) {
      return error instanceof ApiKeyLimitError
        ? errorBody(context, 409, 'limit_reached', 'Too many active keys')
        : errorBody(context, 500, 'internal_error', 'Request failed')
    }
  }

  routes.get('/api/api-keys', (context) =>
    withSession(context, async (scope) =>
      context.json({ data: { keys: await scope.keys.list(scope.tenantId) } }),
    ),
  )

  routes.post('/api/api-keys', (context) =>
    withSession(context, async (scope) => {
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

      const parsed = createApiKeyRequestSchema.safeParse(body)

      if (!parsed.success) {
        return errorBody(
          context,
          422,
          'validation_failed',
          'The name is invalid',
        )
      }

      return context.json(
        { data: await scope.keys.create(scope.tenantId, parsed.data.name) },
        201,
      )
    }),
  )

  routes.delete('/api/api-keys/:keyId', (context) =>
    withSession(context, async (scope) => {
      const keyId = monitorIdSchema.safeParse(context.req.param('keyId'))

      if (!keyId.success) {
        return errorBody(context, 404, 'not_found', 'Key not found')
      }

      return (await scope.keys.revoke(scope.tenantId, keyId.data))
        ? context.body(null, 204)
        : errorBody(context, 404, 'not_found', 'Key not found')
    }),
  )

  // Read-only public API, authenticated by a bearer key (no cookie involved).
  async function withKey(
    context: Context,
    handler: (tenantId: string) => Promise<Response>,
  ): Promise<Response> {
    const presented = readBearer(context)

    try {
      const tenantId = presented
        ? await dependencies.authenticator.tenantFor(presented)
        : null

      return tenantId
        ? await handler(tenantId)
        : errorBody(context, 401, 'unauthorized', 'A valid API key is required')
    } catch {
      return errorBody(context, 500, 'internal_error', 'Request failed')
    }
  }

  routes.get('/api/v1/monitors', (context) =>
    withKey(context, async (tenantId) =>
      context.json({
        data: {
          monitors: (await dependencies.monitors.list(tenantId)).map(
            toMonitorResponse,
          ),
        },
      }),
    ),
  )

  routes.get('/api/v1/monitors/:monitorId', (context) =>
    withKey(context, async (tenantId) => {
      const monitorId = monitorIdSchema.safeParse(
        context.req.param('monitorId'),
      )
      const monitor = monitorId.success
        ? await dependencies.monitors.get(tenantId, monitorId.data)
        : null

      return monitor
        ? context.json({ data: { monitor: toMonitorResponse(monitor) } })
        : errorBody(context, 404, 'monitor_not_found', 'Monitor not found')
    }),
  )

  return routes
}
