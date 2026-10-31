import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { createOriginGuard } from './origin-guard.ts'

const APP_ORIGIN = 'https://app.vextra.test'

function createApp() {
  const app = new Hono()

  app.use('*', createOriginGuard(APP_ORIGIN))
  app.get('/api/read', (context) => context.text('read'))
  app.post('/api/write', (context) => context.text('written'))

  return app
}

describe('createOriginGuard', () => {
  it('allows reads without an Origin header', async () => {
    const response = await createApp().request('/api/read')

    expect(response.status).toBe(200)
  })

  it('allows mutations from the configured application origin', async () => {
    const response = await createApp().request('/api/write', {
      headers: { origin: APP_ORIGIN },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('written')
  })

  it.each([
    ['missing origin', undefined],
    ['a foreign origin', 'https://attacker.test'],
    ['a malformed origin', 'not-an-origin'],
  ])('rejects mutations with %s', async (_label, origin) => {
    const requestInit: RequestInit = { method: 'POST' }

    if (origin !== undefined) {
      requestInit.headers = { origin }
    }

    const response = await createApp().request('/api/write', requestInit)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'origin_rejected',
        message: 'Request origin is not allowed',
      },
    })
  })
})
