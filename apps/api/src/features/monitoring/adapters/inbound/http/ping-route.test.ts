import { describe, expect, it, vi } from 'vitest'

import { createPingRoutes } from './ping-route.ts'

const TOKEN = 'A'.repeat(43)

function createApp(execute = vi.fn(async () => true)) {
  const recordEvent = vi.fn(async () => true)
  const app = createPingRoutes({ execute, recordEvent })

  return { app, execute, recordEvent }
}

function createRequest(
  token = TOKEN,
  init: Omit<RequestInit, 'headers'> & {
    headers?: Record<string, string>
  } = {},
) {
  return new Request('https://api.vextra.test/api/ping', {
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
      'https://api.vextra.test/api/ping?server=production',
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
    const response = await app.request('https://api.vextra.test/api/ping')

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })
})

describe('ping by URL and run events', () => {
  const url = (path: string, method = 'GET') =>
    new Request(`https://api.vextra.test/api/ping/${path}`, { method })

  it.each(['GET', 'HEAD', 'POST'])(
    'accepts a success ping with the token in the path (%s)',
    async (method) => {
      const { app, execute } = createApp()
      const response = await app.request(url(TOKEN, method))

      expect(response.status).toBe(204)
      expect(execute).toHaveBeenCalledWith(TOKEN)
    },
  )

  it.each(['start', 'fail', 'warn'])(
    'records a %s event from the path or the bearer header',
    async (kind) => {
      const { app, recordEvent } = createApp()

      expect((await app.request(url(`${TOKEN}/${kind}`))).status).toBe(204)
      expect(recordEvent).toHaveBeenLastCalledWith(TOKEN, kind)

      const bearer = await app.request(
        new Request(`https://api.vextra.test/api/ping/${kind}`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
          method: 'POST',
        }),
      )

      expect(bearer.status).toBe(204)
      expect(recordEvent).toHaveBeenLastCalledWith(TOKEN, kind)
    },
  )

  it('maps an exit status to success or failure', async () => {
    const { app, execute, recordEvent } = createApp()

    expect((await app.request(url(`${TOKEN}/0`))).status).toBe(204)
    expect(execute).toHaveBeenCalledWith(TOKEN)

    expect((await app.request(url(`${TOKEN}/137`))).status).toBe(204)
    expect(recordEvent).toHaveBeenLastCalledWith(TOKEN, 'fail')

    expect((await app.request(url(`${TOKEN}/256`))).status).toBe(400)
  })

  it('rejects data, malformed tokens and unknown tokens', async () => {
    const { app } = createApp()

    expect((await app.request(url(`${TOKEN}?msg=hi`))).status).toBe(400)
    expect(
      (
        await app.request(
          new Request(`https://api.vextra.test/api/ping/${TOKEN}`, {
            body: 'output',
            headers: { 'content-type': 'text/plain' },
            method: 'POST',
          }),
        )
      ).status,
    ).toBe(400)
    expect((await app.request(url('short'))).status).toBe(404)
    expect(
      (
        await app.request(
          new Request('https://api.vextra.test/api/ping/start', {
            method: 'POST',
          }),
        )
      ).status,
    ).toBe(401)

    const unknown = createPingRoutes({
      execute: async () => false,
      recordEvent: async () => false,
    })

    expect((await unknown.request(url(TOKEN))).status).toBe(401)
    expect((await unknown.request(url(`${TOKEN}/fail`))).status).toBe(401)
  })

  it('answers 503 when storage fails for an event', async () => {
    const failing = createPingRoutes({
      execute: async () => true,
      recordEvent: async () => {
        throw new Error('db')
      },
    })

    expect((await failing.request(url(`${TOKEN}/start`))).status).toBe(503)
  })
})
