import { describe, expect, it, vi } from 'vitest'

import type { CreateMonitorResult } from '../../../application/create-monitor.ts'
import type { MonitorStateRecord } from '../../../application/monitor-read.ts'
import {
  createMonitorRoutes,
  type AuthenticatedPrincipal,
} from './monitor-routes.ts'

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

const MONITOR_STATE: MonitorStateRecord = {
  alertAtMs: Date.parse('2026-01-01T00:05:30.000Z'),
  createdAtMs: Date.parse('2026-01-01T00:00:00.000Z'),
  graceSeconds: 30,
  id: '20000000-0000-4000-8000-000000000001',
  incidentOpenedAtMs: null,
  intervalSeconds: 300,
  lastHeartbeatAtMs: null,
  pausedAtMs: null,
  status: 'pending',
  tenantId: 'tenant-a',
}

function createRoutes(principal: AuthenticatedPrincipal | null = null) {
  const execute = vi.fn(async () => RESULT)
  const get = vi.fn(async () => MONITOR_STATE)
  const list = vi.fn(async () => [MONITOR_STATE] as const)
  const app = createMonitorRoutes({
    authenticate: async () =>
      principal
        ? {
            createMonitor: { execute },
            monitorRead: { get, list },
            principal,
          }
        : null,
  })

  return { app, execute, get, list }
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
        monitorRead: {
          get: vi.fn(async () => null),
          list: vi.fn(async () => []),
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
        monitorRead: {
          get: vi.fn(async () => null),
          list: vi.fn(async () => []),
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

describe('monitor read routes', () => {
  it('requires an authenticated principal for reads', async () => {
    const { app, get, list } = createRoutes()

    const listResponse = await app.request('/api/monitors')
    const detailResponse = await app.request(
      '/api/monitors/20000000-0000-4000-8000-000000000001',
    )

    expect(listResponse.status).toBe(401)
    expect(detailResponse.status).toBe(401)
    expect(list).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })

  it('lists monitor state for the authenticated tenant', async () => {
    const { app, list } = createRoutes({
      tenantId: 'tenant-a',
      userId: 'user-a',
    })
    const response = await app.request('/api/monitors')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        monitors: [
          {
            alertAt: '2026-01-01T00:05:30.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
            graceSeconds: 30,
            id: '20000000-0000-4000-8000-000000000001',
            incidentOpenedAt: null,
            intervalSeconds: 300,
            lastHeartbeatAt: null,
            pausedAt: null,
            status: 'pending',
          },
        ],
      },
    })
    expect(list).toHaveBeenCalledWith('tenant-a')
  })

  it('returns one tenant-scoped monitor', async () => {
    const { app, get } = createRoutes({
      tenantId: 'tenant-a',
      userId: 'user-a',
    })
    const response = await app.request(
      '/api/monitors/20000000-0000-4000-8000-000000000001',
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        monitor: {
          id: '20000000-0000-4000-8000-000000000001',
          status: 'pending',
        },
      },
    })
    expect(get).toHaveBeenCalledWith(
      'tenant-a',
      '20000000-0000-4000-8000-000000000001',
    )
  })

  it('returns a safe 404 for absent or invalid monitor ids', async () => {
    const absentApp = createMonitorRoutes({
      authenticate: async () => ({
        createMonitor: { execute: vi.fn() },
        monitorRead: {
          get: vi.fn(async () => null),
          list: vi.fn(async () => []),
        },
        principal: { tenantId: 'tenant-a', userId: 'user-a' },
      }),
    })
    const invalid = await absentApp.request('/api/monitors/not-a-uuid')
    const absent = await absentApp.request(
      '/api/monitors/20000000-0000-4000-8000-000000000001',
    )

    expect(invalid.status).toBe(404)
    expect(absent.status).toBe(404)
    await expect(absent.json()).resolves.toEqual({
      error: {
        code: 'monitor_not_found',
        message: 'Monitor not found',
      },
    })
  })

  it('does not expose query failures', async () => {
    const app = createMonitorRoutes({
      authenticate: async () => ({
        createMonitor: { execute: vi.fn() },
        monitorRead: {
          get: vi.fn(async () => {
            throw new Error('database unavailable')
          }),
          list: vi.fn(async () => {
            throw new Error('database unavailable')
          }),
        },
        principal: { tenantId: 'tenant-a', userId: 'user-a' },
      }),
    })
    const listResponse = await app.request('/api/monitors')
    const detailResponse = await app.request(
      '/api/monitors/20000000-0000-4000-8000-000000000001',
    )

    expect(listResponse.status).toBe(500)
    expect(detailResponse.status).toBe(500)
  })
})
