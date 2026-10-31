import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { createApiApp } from './app.ts'

function createApp() {
  return createApiApp({
    accountRoutes: new Hono(),
    allowedOrigin: 'http://localhost:5173',
    authRoutes: new Hono(),
    channelRoutes: new Hono(),
    liveRoutes: new Hono(),
    monitorRoutes: new Hono(),
    notificationRoutes: new Hono(),
    pingRoutes: new Hono(),
    statusPageRoutes: new Hono(),
    maintenanceRoutes: new Hono(),
    apiKeyRoutes: new Hono(),
    teamRoutes: new Hono(),
    workspaceRoutes: new Hono(),
  })
}

describe('GET /api/health', () => {
  it('reports that the API is ready', async () => {
    const response = await createApp().request('/api/health')

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    await expect(response.json()).resolves.toEqual({
      service: 'vextra-api',
      status: 'ok',
    })
  })

  it('applies the origin guard to cookie-authenticated dashboard mutations', async () => {
    const response = await createApp().request('/api/auth/logout', {
      method: 'POST',
    })

    expect(response.status).toBe(403)
  })
})

describe('rate limiting wiring', () => {
  function createLimitedApp(allow: () => Promise<boolean>) {
    return createApiApp({
      accountRoutes: new Hono(),
      allowedOrigin: 'http://localhost:5173',
      authRoutes: new Hono()
        .post('/api/auth/login', (context) => context.json({ ok: 1 }))
        .post('/api/auth/signup', (context) => context.json({ ok: 1 })),
      channelRoutes: new Hono(),
      liveRoutes: new Hono(),
      monitorRoutes: new Hono(),
      notificationRoutes: new Hono(),
      pingRoutes: new Hono()
        .post('/api/ping', (context) => context.json({ ok: 1 }))
        .get('/api/ping/:token', (context) => context.json({ ok: 1 })),
      statusPageRoutes: new Hono(),
      maintenanceRoutes: new Hono(),
      apiKeyRoutes: new Hono(),
      teamRoutes: new Hono(),
      workspaceRoutes: new Hono(),
      rateLimiters: { auth: { allow }, ping: { allow } },
    })
  }

  it('limits pings sent by URL with GET as well', async () => {
    const app = createLimitedApp(async () => false)
    const response = await app.request(`/api/ping/${'A'.repeat(43)}`, {
      method: 'GET',
    })

    expect(response.status).toBe(429)
  })

  it.each(['/api/auth/login', '/api/auth/signup', '/api/ping'])(
    'limits %s',
    async (path) => {
      const app = createLimitedApp(async () => false)
      const response = await app.request(path, {
        headers: { origin: 'http://localhost:5173' },
        method: 'POST',
      })

      expect(response.status).toBe(429)
    },
  )

  it('does not limit logout', async () => {
    const app = createLimitedApp(async () => false)
    const response = await app.request('/api/auth/logout', {
      headers: { origin: 'http://localhost:5173' },
      method: 'POST',
    })

    expect(response.status).not.toBe(429)
  })
})

describe('cache policy', () => {
  it('keeps a route-provided Cache-Control while hardening other headers', async () => {
    const statusPageRoutes = new Hono().get('/api/status/x/badge.svg', (c) => {
      c.header('Cache-Control', 'public, max-age=300')

      return c.body('<svg/>')
    })
    const app = createApiApp({
      accountRoutes: new Hono(),
      allowedOrigin: 'http://localhost:5173',
      apiKeyRoutes: new Hono(),
      authRoutes: new Hono(),
      channelRoutes: new Hono(),
      liveRoutes: new Hono(),
      maintenanceRoutes: new Hono(),
      monitorRoutes: new Hono(),
      notificationRoutes: new Hono(),
      pingRoutes: new Hono(),
      statusPageRoutes,
      teamRoutes: new Hono(),
      workspaceRoutes: new Hono(),
    })
    const response = await app.request('/api/status/x/badge.svg')

    expect(response.headers.get('cache-control')).toBe('public, max-age=300')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('read-only role guard', () => {
  function appWith(canWrite: () => Promise<boolean>) {
    const ok = (c: { json: (body: unknown) => Response }) => c.json({ ok: 1 })

    return createApiApp({
      accountRoutes: new Hono(),
      allowedOrigin: 'http://localhost:5173',
      apiKeyRoutes: new Hono(),
      authRoutes: new Hono().post('/api/auth/login', ok),
      canWrite,
      channelRoutes: new Hono(),
      liveRoutes: new Hono(),
      maintenanceRoutes: new Hono(),
      monitorRoutes: new Hono()
        .get('/api/monitors', ok)
        .post('/api/monitors', ok)
        .delete('/api/monitors/:id', ok),
      notificationRoutes: new Hono(),
      pingRoutes: new Hono().post('/api/ping', ok),
      statusPageRoutes: new Hono(),
      teamRoutes: new Hono().delete('/api/team/members/:id', ok),
      workspaceRoutes: new Hono(),
    })
  }

  const request = (app: Hono, method: string, path: string) =>
    app.request(path, {
      headers: { origin: 'http://localhost:5173' },
      method,
    })

  it('rejects writes of a read-only role but still allows reads', async () => {
    const app = appWith(async () => false)

    expect((await request(app, 'GET', '/api/monitors')).status).toBe(200)

    const post = await request(app, 'POST', '/api/monitors')

    expect(post.status).toBe(403)
    await expect(post.json()).resolves.toMatchObject({
      error: { code: 'read_only' },
    })
    expect((await request(app, 'DELETE', '/api/monitors/x')).status).toBe(403)
  })

  it('leaves auth, pings and leaving a team available to every role', async () => {
    const app = appWith(async () => false)

    expect((await request(app, 'POST', '/api/auth/login')).status).toBe(200)
    expect((await request(app, 'POST', '/api/ping')).status).toBe(200)
    expect((await request(app, 'DELETE', '/api/team/members/x')).status).toBe(
      200,
    )
  })

  it('lets writers through', async () => {
    const app = appWith(async () => true)

    expect((await request(app, 'POST', '/api/monitors')).status).toBe(200)
  })
})
