import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { createApiApp } from './app.ts'

function createApp() {
  return createApiApp({
    allowedOrigin: 'http://localhost:5173',
    authRoutes: new Hono(),
    monitorRoutes: new Hono(),
    pingRoutes: new Hono(),
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
