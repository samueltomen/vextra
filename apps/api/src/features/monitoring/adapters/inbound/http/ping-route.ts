import { Hono, type Context } from 'hono'

const BEARER_TOKEN_PATTERN = /^Bearer ([A-Za-z0-9_-]{43})$/u

export type PingRoutesDependencies = Readonly<{
  execute: (token: string) => Promise<boolean>
}>

function parseBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null
  }

  return BEARER_TOKEN_PATTERN.exec(authorization)?.[1] ?? null
}

function rejected(context: Context) {
  return context.json(
    {
      error: {
        code: 'heartbeat_rejected',
        message: 'Heartbeat rejected',
      },
    },
    401,
  )
}

export function createPingRoutes(
  dependencies: PingRoutesDependencies,
): Hono {
  const routes = new Hono()

  routes.post('/api/ping', async (context) => {
    const url = new URL(context.req.url)

    if (url.search.length > 0 || context.req.raw.body !== null) {
      return context.json(
        {
          error: {
            code: 'invalid_heartbeat_request',
            message: 'Heartbeat requests must not contain data',
          },
        },
        400,
      )
    }

    const token = parseBearerToken(context.req.header('authorization'))

    if (!token) {
      return rejected(context)
    }

    try {
      const accepted = await dependencies.execute(token)

      return accepted ? context.body(null, 204) : rejected(context)
    } catch {
      return context.json(
        {
          error: {
            code: 'heartbeat_unavailable',
            message: 'Heartbeat service is temporarily unavailable',
          },
        },
        503,
      )
    }
  })

  routes.all('/api/ping', (context) =>
    context.body(null, 405, {
      Allow: 'POST',
    }),
  )

  return routes
}
