import { describe, expect, it, vi } from 'vitest'

import { createPingRoutes } from './ping-route.ts'

const TOKEN = 'A'.repeat(43)

function createApp(execute = vi.fn(async () => true)) {
  const app = createPingRoutes({ execute })

  return { app, execute }
}

function createRequest(
  token = TOKEN,
  init: Omit<RequestInit, 'headers'> & {
    headers?: Record<string, string>
  } = {},
) {
  return new Request('https://api.cronping.test/api/ping', {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    method: 'POST',
  })
}

describe('POST /api/ping', () => {
  it('accepts a valid bearer token without returning a body or cookie', async () => {
    const { app, execute } = createApp()
    const response = await app.request(createRequest())

    expect(response.status).toBe(204)
    expect(response.headers.get('set-cookie')).toBeNull()
    await expect(response.text()).resolves.toBe('')
    expect(execute).toHaveBeenCalledWith(TOKEN)
  })

  it.each([
    ['missing token', ''],
    ['too-short token', 'short'],
    ['invalid token characters', `${'A'.repeat(42)}!`],
  ])('rejects %s with the same safe response', async (_label, token) => {
    const { app, execute } = createApp()
    const response = await app.request(createRequest(token))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'heartbeat_rejected',
        message: 'Heartbeat rejected',
      },
    })
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects query parameters and request bodies without reading their content', async () => {
    const { app, execute } = createApp()
    const queryResponse = await app.request(createRequest(TOKEN, {}), undefined)
    const queryRequest = new Request(
      'https://api.cronping.test/api/ping?server=production',
      { headers: { Authorization: `Bearer ${TOKEN}` }, method: 'POST' },
    )
    const queryParamResponse = await app.request(queryRequest)
    const bodyResponse = await app.request(
      createRequest(TOKEN, {
        body: '{"output":"secret"}',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    expect(queryResponse.status).toBe(204)
    expect(queryParamResponse.status).toBe(400)
    expect(bodyResponse.status).toBe(400)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('returns the same rejection for an unknown token', async () => {
    const { app } = createApp(vi.fn(async () => false))
    const response = await app.request(createRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'heartbeat_rejected',
        message: 'Heartbeat rejected',
      },
    })
  })

  it('returns a retryable safe response for storage failures', async () => {
    const { app } = createApp(
      vi.fn(async () => {
        throw new Error('database unavailable')
      }),
    )
    const response = await app.request(createRequest())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'heartbeat_unavailable',
        message: 'Heartbeat service is temporarily unavailable',
      },
    })
  })

  it('refuses non-POST methods with Allow: POST', async () => {
    const { app } = createApp()
    const response = await app.request('https://api.cronping.test/api/ping')

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })
})
