import { Hono } from 'hono'

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
  workspaceRoutes: Hono
  /** Header carrying the client IP (default: Cloudflare's). */
  clientIpHeader?: string
  rateLimiters?: Readonly<{ auth: RateLimiter; ping: RateLimiter }>
}>

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
  app.use('/api/api-keys', originGuard)
  app.use('/api/api-keys/*', originGuard)
  app.use('/api/maintenance', originGuard)
  app.use('/api/maintenance/*', originGuard)
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

  return app
}
