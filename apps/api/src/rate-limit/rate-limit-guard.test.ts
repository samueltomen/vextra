import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { createRateLimitGuard, type RateLimiter } from './rate-limit-guard.ts'

function createApp(limiter: RateLimiter) {
  const app = new Hono()

  app.use('/limited', createRateLimitGuard({ limiter, scope: 'auth' }))
  app.post('/limited', (context) => context.json({ ok: true }))

  return app
}

function post(app: Hono, ip?: string) {
  return app.request('/limited', {
    headers: ip ? { 'cf-connecting-ip': ip } : {},
    method: 'POST',
  })
}

describe('createRateLimitGuard', () => {
  it('lets requests through while the limiter allows them', async () => {
    const response = await post(
      createApp({ allow: async () => true }),
      '1.1.1.1',
    )

    expect(response.status).toBe(200)
  })

  it('answers 429 with Retry-After when the limiter denies the request', async () => {
    const response = await post(
      createApp({ allow: async () => false }),
      '1.1.1.1',
    )

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    await expect(response.json()).resolves.toEqual({
      error: { code: 'rate_limited', message: 'Too many requests' },
    })
  })

  it('keys the limit by scope and client IP', async () => {
    const allow = vi.fn(async () => true)

    await post(createApp({ allow }), '203.0.113.7')

    expect(allow).toHaveBeenCalledWith('auth:203.0.113.7')
  })

  it('uses a shared key when the client IP is unknown', async () => {
    const allow = vi.fn(async () => true)

    await post(createApp({ allow }))

    expect(allow).toHaveBeenCalledWith('auth:unknown')
  })

  it('fails open when the limiter errors so heartbeats are never blocked', async () => {
    const response = await post(
      createApp({
        allow: async () => {
          throw new Error('binding unavailable')
        },
      }),
      '1.1.1.1',
    )

    expect(response.status).toBe(200)
  })

  it('does not limit non-mutating requests', async () => {
    const allow = vi.fn(async () => false)
    const response = await createApp({ allow }).request('/limited')

    expect(allow).not.toHaveBeenCalled()
    expect(response.status).toBe(404)
  })
})
