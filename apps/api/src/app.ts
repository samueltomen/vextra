import { Hono, type Context } from 'hono'

import {
  createRateLimitGuard,
  type RateLimiter,
} from './rate-limit/rate-limit-guard.ts'
import { createOriginGuard } from './features/accounts/adapters/inbound/http/origin-guard.ts'

export type ApiApplicationDependencies = Readonly<{
  accountRoutes: Hono
  allowedOrigin: string
  authRoutes: Hono
  channelRoutes: Hono
  liveRoutes: Hono
  monitorRoutes: Hono
  notificationRoutes: Hono
  pingRoutes: Hono
  statusPageRoutes: Hono
  maintenanceRoutes: Hono
  apiKeyRoutes: Hono
  teamRoutes: Hono
  /** Returns false when the caller's role forbids unsafe methods. */
  canWrite?: (context: Context) => Promise<boolean>
  workspaceRoutes: Hono
  /** Header carrying the client IP (default: Cloudflare's). */
  clientIpHeader?: string
  rateLimiters?: Readonly<{ auth: RateLimiter; ping: RateLimiter }>
}>

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const READ_ONLY_PROTECTED_PREFIXES = [
  '/api/monitors',
  '/api/monitors/*',
  '/api/folders',
  '/api/folders/*',
  '/api/preferences',
  '/api/channels',
  '/api/channels/*',
  '/api/status-page',
  '/api/maintenance',
  '/api/maintenance/*',
  '/api/api-keys',
  '/api/api-keys/*',
] as const

export function createHealthRoutes(): Hono {
  const routes = new Hono()

  routes.get('/api/health', (context) =>
    context.json({
      service: 'vextra-api',
      status: 'ok',
    }),
  )

  return routes
}

export function createApiApp(dependencies: ApiApplicationDependencies): Hono {
  const app = new Hono()

  app.use('*', async (context, next) => {
    await next()
    // Endpoints that opt into caching (public badges) set their own header.
    if (!context.res.headers.has('Cache-Control')) {
      context.header('Cache-Control', 'no-store')
    }
    context.header(
      'Content-Security-Policy',
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    )
    context.header('Referrer-Policy', 'no-referrer')
    context.header('X-Content-Type-Options', 'nosniff')
    context.header('X-Frame-Options', 'DENY')
  })
  const originGuard = createOriginGuard(dependencies.allowedOrigin)

  if (dependencies.rateLimiters) {
    const authLimit = createRateLimitGuard({
      ...(dependencies.clientIpHeader
        ? { clientIpHeader: dependencies.clientIpHeader }
        : {}),
      limiter: dependencies.rateLimiters.auth,
      scope: 'auth',
    })

    app.use('/api/auth/login', authLimit)
    app.use('/api/auth/signup', authLimit)
    app.use(
      '/api/v1/*',
      createRateLimitGuard({
        ...(dependencies.clientIpHeader
          ? { clientIpHeader: dependencies.clientIpHeader }
          : {}),
        limiter: dependencies.rateLimiters.ping,
        methods: ['GET', 'HEAD'],
        scope: 'v1',
      }),
    )
    app.use(
      '/api/status/*',
      createRateLimitGuard({
        ...(dependencies.clientIpHeader
          ? { clientIpHeader: dependencies.clientIpHeader }
          : {}),
        limiter: dependencies.rateLimiters.ping,
        methods: ['GET', 'HEAD'],
        scope: 'status',
      }),
    )
    app.use(
      '/api/ping/*',
      createRateLimitGuard({
        ...(dependencies.clientIpHeader
          ? { clientIpHeader: dependencies.clientIpHeader }
          : {}),
        limiter: dependencies.rateLimiters.ping,
        methods: ['GET', 'HEAD', 'POST'],
        scope: 'ping',
      }),
    )
  }

  app.use('/api/auth/*', originGuard)
  app.use('/api/account', originGuard)
  app.use('/api/monitors', originGuard)
  app.use('/api/monitors/*', originGuard)
  app.use('/api/notifications', originGuard)
  app.use('/api/channels', originGuard)
  app.use('/api/channels/*', originGuard)
  app.use('/api/folders', originGuard)
  app.use('/api/folders/*', originGuard)
  app.use('/api/preferences', originGuard)
  app.use('/api/status-page', originGuard)
  app.use('/api/team/*', originGuard)
  app.use('/api/api-keys', originGuard)
  app.use('/api/api-keys/*', originGuard)
  app.use('/api/maintenance', originGuard)
  app.use('/api/maintenance/*', originGuard)
  if (dependencies.canWrite) {
    const canWrite = dependencies.canWrite

    // Spaces where the caller only has read access reject every write to the
    // tenant's data. Auth, account, team (leave/accept) and pings are exempt.
    for (const prefix of READ_ONLY_PROTECTED_PREFIXES) {
      app.use(prefix, async (context, next) => {
        if (SAFE_METHODS.has(context.req.method) || (await canWrite(context))) {
          return next()
        }

        return context.json(
          {
            error: {
              code: 'read_only',
              message: 'Your role in this space is read-only',
            },
          },
          403,
        )
      })
    }
  }

  app.route('/', createHealthRoutes())
  app.route('/', dependencies.accountRoutes)
  app.route('/', dependencies.authRoutes)
  app.route('/', dependencies.monitorRoutes)
  app.route('/', dependencies.notificationRoutes)
  app.route('/', dependencies.workspaceRoutes)
  app.route('/', dependencies.channelRoutes)
  app.route('/', dependencies.liveRoutes)
  app.route('/', dependencies.pingRoutes)
  app.route('/', dependencies.statusPageRoutes)
  app.route('/', dependencies.maintenanceRoutes)
  app.route('/', dependencies.apiKeyRoutes)
  app.route('/', dependencies.teamRoutes)

  return app
}
