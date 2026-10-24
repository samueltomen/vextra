import { describe, expect, it, vi } from 'vitest'

import type { CreateMonitorResult } from '../../../application/create-monitor.ts'
import {
  createMonitorRoutes,
  type AuthenticatedPrincipal,
} from './create-monitor-route.ts'

const RESULT: CreateMonitorResult = {
  monitor: {
    id: 'monitor-1',
    tenantId: 'tenant-a',
    intervalSeconds: 300,
    graceSeconds: 30,
    status: 'pending',
    lastHeartbeatAtMs: null,
    alertAtMs: Date.parse('2026-01-01T00:05:30.000Z'),
    incidentOpenedAtMs: null,
    pausedAtMs: null,
  },
  heartbeatToken: 'raw-secret-token',
}

function createRoutes(principal: AuthenticatedPrincipal | null = null) {
  const execute = vi.fn(async () => RESULT)
  const app = createMonitorRoutes({
    authenticate: async () =>
      principal
        ? {
            createMonitor: { execute },
            principal,
          }
        : null,
  })

  return { app, execute }
}

function createRequest(body: unknown) {
  return new Request('http://localhost/api/monitors', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/monitors', () => {
  it('requires an authenticated principal', async () => {
    const { app, execute } = createRoutes()
    const response = await app.request(
      createRequest({ intervalSeconds: 300, graceSeconds: 30 }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authentication required',
      },
    })
    expect(execute).not.toHaveBeenCalled()
  })

  it('creates a monitor in the principal tenant', async () => {
    const { app, execute } = createRoutes({
      tenantId: 'tenant-a',
      userId: 'user-a',
    })
    const response = await app.request(
      createRequest({ intervalSeconds: 300, graceSeconds: 30 }),
    )

    expect(response.status).toBe(201)
    expect(response.headers.get('location')).toBe('/api/monitors/monitor-1')
    await expect(response.json()).resolves.toEqual({
      data: {
        id: 'monitor-1',
        intervalSeconds: 300,
        graceSeconds: 30,
        status: 'pending',
        alertAt: '2026-01-01T00:05:30.000Z',
        heartbeatToken: 'raw-secret-token',
      },
    })
    expect(execute).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      intervalSeconds: 300,
      graceSeconds: 30,
    })
  })

  it('rejects a tenant identifier supplied by the client', async () => {
    const { app, execute } = createRoutes({
      tenantId: 'tenant-a',
      userId: 'user-a',
    })
    const response = await app.request(
      createRequest({
        tenantId: 'tenant-b',
        intervalSeconds: 300,
        graceSeconds: 30,
      }),
    )

    expect(response.status).toBe(422)
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects invalid scheduling values', async () => {
    const { app, execute } = createRoutes({
      tenantId: 'tenant-a',
      userId: 'user-a',
    })
    const response = await app.request(
      createRequest({ intervalSeconds: 59, graceSeconds: 30 }),
    )
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toMatchObject({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
      },
    })
    expect(execute).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON', async () => {
    const { app } = createRoutes({
      tenantId: 'tenant-a',
      userId: 'user-a',
    })
    const response = await app.request(
      new Request('http://localhost/api/monitors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{invalid',
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'invalid_json',
        message: 'Request body must be valid JSON',
      },
    })
  })

  it('maps domain validation failures to a safe 422 response', async () => {
    const app = createMonitorRoutes({
      authenticate: async () => ({
        createMonitor: {
          execute: async () => {
            throw new RangeError('interval out of range')
          },
        },
        principal: {
          tenantId: 'tenant-a',
          userId: 'user-a',
        },
      }),
    })
    const response = await app.request(
      createRequest({ intervalSeconds: 300, graceSeconds: 30 }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
      },
    })
  })

  it('does not expose unexpected persistence failures', async () => {
    const app = createMonitorRoutes({
      authenticate: async () => ({
        createMonitor: {
          execute: async () => {
            throw new Error('provider-specific database failure')
          },
        },
        principal: {
          tenantId: 'tenant-a',
          userId: 'user-a',
        },
      }),
    })
    const response = await app.request(
      createRequest({ intervalSeconds: 300, graceSeconds: 30 }),
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
      },
    })
  })
})
