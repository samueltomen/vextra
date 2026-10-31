import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { createApiApp } from './app.ts'

function createApp() {
  return createApiApp({
    accountRoutes: new Hono(),
    allowedOrigin: 'http://localhost:5173',
    authRoutes: new Hono(),
    liveRoutes: new Hono(),
    monitorRoutes: new Hono(),
    notificationRoutes: new Hono(),
    pingRoutes: new Hono(),
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
      service: 'cronping-api',
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
      liveRoutes: new Hono(),
      monitorRoutes: new Hono(),
      notificationRoutes: new Hono(),
      pingRoutes: new Hono()
        .post('/api/ping', (context) => context.json({ ok: 1 }))
        .get('/api/ping/:token', (context) => context.json({ ok: 1 })),
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
