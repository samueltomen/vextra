import { Hono } from 'hono'

import { createOriginGuard } from './features/accounts/adapters/inbound/http/origin-guard.ts'

export type ApiApplicationDependencies = Readonly<{
  allowedOrigin: string
  authRoutes: Hono
  monitorRoutes: Hono
}>

export function createHealthRoutes(): Hono {
  const routes = new Hono()

  routes.get('/api/health', (context) =>
    context.json({
      service: 'cronping-api',
      status: 'ok',
    }),
  )

  return routes
}

export function createApiApp(dependencies: ApiApplicationDependencies): Hono {
  const app = new Hono()

  app.use('*', async (context, next) => {
    await next()
    context.header('Cache-Control', 'no-store')
    context.header(
      'Content-Security-Policy',
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    )
    context.header('Referrer-Policy', 'no-referrer')
    context.header('X-Content-Type-Options', 'nosniff')
    context.header('X-Frame-Options', 'DENY')
  })
  const originGuard = createOriginGuard(dependencies.allowedOrigin)

  app.use('/api/auth/*', originGuard)
  app.use('/api/monitors', originGuard)
  app.use('/api/monitors/*', originGuard)
  app.route('/', createHealthRoutes())
  app.route('/', dependencies.authRoutes)
  app.route('/', dependencies.monitorRoutes)

  return app
}
