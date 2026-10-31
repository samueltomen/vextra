import { Hono, type Context } from 'hono'

export type LiveRoutesDependencies = Readonly<{
  allowedOrigin: string
  authenticate: (
    context: Context,
  ) => Promise<Readonly<{ tenantId: string }> | null>
  connect: (tenantId: string, request: Request) => Promise<Response>
}>

function problem(
  context: Context,
  status: 401 | 403 | 426 | 500,
  code: string,
  message: string,
) {
  return context.json({ error: { code, message } }, status)
}

export function createLiveRoutes(dependencies: LiveRoutesDependencies): Hono {
  const routes = new Hono()
  const allowedOrigin = new URL(dependencies.allowedOrigin).origin

  routes.get('/api/live', async (context) => {
    if (context.req.header('upgrade')?.toLowerCase() !== 'websocket') {
      return problem(
        context,
        426,
        'upgrade_required',
        'This endpoint requires a WebSocket connection',
      )
    }

    // Browsers always send Origin on a WebSocket handshake; checking it blocks
    // cross-site WebSocket hijacking of the cookie session.
    if (context.req.header('origin') !== allowedOrigin) {
      return problem(
        context,
        403,
        'origin_rejected',
        'Request origin is not allowed',
      )
    }

    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return problem(context, 401, 'unauthorized', 'Authentication required')
    }

    try {
      return await dependencies.connect(scope.tenantId, context.req.raw)
    } catch {
      return problem(
        context,
        500,
        'internal_error',
        'An unexpected error occurred',
      )
    }
  })

  return routes
}
