import { Hono, type Context } from 'hono'

const BEARER_TOKEN_PATTERN = /^Bearer ([A-Za-z0-9_-]{43})$/u
const TOKEN_PARAM = '{[A-Za-z0-9_-]{43}}'

export type RunEventKind = 'fail' | 'start' | 'warn'

export type PingRoutesDependencies = Readonly<{
  execute: (token: string) => Promise<boolean>
  recordEvent: (token: string, kind: RunEventKind) => Promise<boolean>
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

function hasData(context: Context): boolean {
  const url = new URL(context.req.url)
  const contentLength = context.req.header('content-length')

  return (
    url.search.length > 0 ||
    (contentLength !== undefined && contentLength !== '0') ||
    context.req.header('content-type') !== undefined ||
    context.req.header('transfer-encoding') !== undefined
  )
}

export function createPingRoutes(dependencies: PingRoutesDependencies): Hono {
  const routes = new Hono()

  async function handle(
    context: Context,
    token: string | null,
    kind: 'success' | RunEventKind,
  ) {
    if (hasData(context)) {
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

    if (!token) {
      return rejected(context)
    }

    try {
      const accepted =
        kind === 'success'
          ? await dependencies.execute(token)
          : await dependencies.recordEvent(token, kind)

      return accepted ? context.body(null, 204) : rejected(context)
    } catch (error) {
      // Never log the token: only the failing step (our own error message).
      console.warn(
        JSON.stringify({
          event: 'ping.storage_failed',
          reason: error instanceof Error ? error.message : 'unknown',
        }),
      )

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
  }

  // Token in the Authorization header: keeps the secret out of URLs and logs.
  routes.post('/api/ping', (context) =>
    handle(
      context,
      parseBearerToken(context.req.header('authorization')),
      'success',
    ),
  )

  routes.post('/api/ping/:event{start|fail|warn}', (context) =>
    handle(
      context,
      parseBearerToken(context.req.header('authorization')),
      context.req.param('event') as RunEventKind,
    ),
  )

  // Token in the path: convenient for `wget`/`curl` one-liners and platforms
  // that cannot set headers. HEAD is answered like GET.
  routes.on(
    ['GET', 'HEAD', 'POST'],
    `/api/ping/:token${TOKEN_PARAM}`,
    (context) => handle(context, context.req.param('token'), 'success'),
  )

  routes.on(
    ['GET', 'HEAD', 'POST'],
    `/api/ping/:token${TOKEN_PARAM}/:event{start|fail|warn}`,
    (context) =>
      handle(
        context,
        context.req.param('token'),
        context.req.param('event') as RunEventKind,
      ),
  )

  // Exit status of the job: 0 is a success, 1-255 is a failure.
  routes.on(
    ['GET', 'HEAD', 'POST'],
    `/api/ping/:token${TOKEN_PARAM}/:code{[0-9]{1,3}}`,
    (context) => {
      const code = Number(context.req.param('code'))

      return code > 255
        ? context.json(
            {
              error: {
                code: 'invalid_exit_code',
                message: 'Exit code must be between 0 and 255',
              },
            },
            400,
          )
        : handle(
            context,
            context.req.param('token'),
            code === 0 ? 'success' : 'fail',
          )
    },
  )

  routes.all('/api/ping', (context) =>
    context.body(null, 405, {
      Allow: 'POST',
    }),
  )

  return routes
}
