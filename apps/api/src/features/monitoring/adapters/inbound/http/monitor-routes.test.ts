import { InvalidCronError } from '@vextra/domain'
import { describe, expect, it, vi } from 'vitest'

import type { CreateMonitorResult } from '../../../application/create-monitor.ts'
import type { MonitorIncidentRecord } from '../../../application/monitor-incidents.ts'
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
  alertsEnabled: true,
  createdAtMs: Date.parse('2026-01-01T00:00:00.000Z'),
  cronExpression: null,
  cronTimezone: null,
  tags: ['prod'],
  description: null,
  folderId: null,
  graceSeconds: 30,
  id: '20000000-0000-4000-8000-000000000001',
  incidentOpenedAtMs: null,
  intervalSeconds: 300,
  lastHeartbeatAtMs: null,
  name: null,
  notes: null,
  pausedAtMs: null,
  runningSinceMs: null,
  status: 'pending',
  tenantId: 'tenant-a',
  totalPings: 0,
}

const MONITOR_INCIDENT: MonitorIncidentRecord = {
  id: '60000000-0000-4000-8000-000000000001',
  monitorId: MONITOR_STATE.id,
  openedAtMs: Date.parse('2026-01-01T00:00:00.000Z'),
  reason: 'heartbeat_missed',
  resolutionReason: null,
  resolvedAtMs: null,
}

function createRoutes(principal: AuthenticatedPrincipal | null = null) {
  const execute = vi.fn(async () => RESULT)
  const get = vi.fn(async () => MONITOR_STATE)
  const list = vi.fn(async () => [MONITOR_STATE] as const)
  const listIncidents = vi.fn(async () => [MONITOR_INCIDENT] as const)
  const pause = vi.fn(async () => true)
  const resume = vi.fn(async () => true)
  const remove = vi.fn(async () => true)
  const rotateToken = vi.fn(async () => 'new-raw-token')
  const updateSchedule = vi.fn(async () => true)
  const app = createMonitorRoutes({
    authenticate: async () =>
      principal
        ? {
            createMonitor: { execute },
            monitorIncidents: { list: listIncidents },
            monitorMetrics: {
              activity: vi.fn(async () => []),
              get: vi.fn(async () => null),
              runs: vi.fn(async () => null),
            },
            monitorLifecycle: { delete: remove, pause, resume },
            monitorRead: { get, list },
            monitorSchedule: { execute: updateSchedule },
            principal,
            rotateToken: { execute: rotateToken },
          }
        : null,
  })

  return {
    app,
    execute,
    get,
    list,
    listIncidents,
    pause,
    remove,
    rotateToken,
    resume,
    updateSchedule,
  }
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

  it('creates a cron monitor and maps an invalid expression to 422', async () => {
    const { app, execute } = createRoutes({
      tenantId: 'tenant-a',
      userId: 'user-a',
    })
    const cron = {
      cron: '0 3 * * *',
      graceSeconds: 60,
      timezone: 'Europe/Paris',
    }

    expect((await app.request(createRequest(cron))).status).toBe(201)
    expect(execute).toHaveBeenCalledWith({
      cron: { expression: '0 3 * * *', timezone: 'Europe/Paris' },
      graceSeconds: 60,
      tenantId: 'tenant-a',
    })

    execute.mockRejectedValueOnce(new InvalidCronError('bad'))
    const invalid = await app.request(createRequest(cron))

    expect(invalid.status).toBe(422)
    await expect(invalid.json()).resolves.toMatchObject({
      error: { code: 'invalid_cron' },
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
        monitorIncidents: { list: vi.fn(async () => []) },
        monitorMetrics: {
          activity: vi.fn(async () => []),
          get: vi.fn(async () => null),
          runs: vi.fn(async () => null),
        },
        monitorLifecycle: {
          delete: vi.fn(async () => true),
          pause: vi.fn(async () => true),
          resume: vi.fn(async () => true),
        },
        monitorRead: {
          get: vi.fn(async () => null),
          list: vi.fn(async () => []),
        },
        principal: {
          tenantId: 'tenant-a',
          userId: 'user-a',
        },
        monitorSchedule: { execute: vi.fn(async () => true) },
        rotateToken: { execute: vi.fn(async () => null) },
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
        monitorIncidents: { list: vi.fn(async () => []) },
        monitorMetrics: {
          activity: vi.fn(async () => []),
          get: vi.fn(async () => null),
          runs: vi.fn(async () => null),
        },
        monitorLifecycle: {
          delete: vi.fn(async () => true),
          pause: vi.fn(async () => true),
          resume: vi.fn(async () => true),
        },
        monitorRead: {
          get: vi.fn(async () => null),
          list: vi.fn(async () => []),
        },
        principal: {
          tenantId: 'tenant-a',
          userId: 'user-a',
        },
        monitorSchedule: { execute: vi.fn(async () => true) },
        rotateToken: { execute: vi.fn(async () => null) },
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
            alertsEnabled: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            cronExpression: null,
            cronTimezone: null,
            tags: ['prod'],
            description: null,
            folderId: null,
            graceSeconds: 30,
            id: '20000000-0000-4000-8000-000000000001',
            incidentOpenedAt: null,
            intervalSeconds: 300,
            lastHeartbeatAt: null,
            name: null,
            notes: null,
            pausedAt: null,
            runningSince: null,
            status: 'pending',
            totalPings: 0,
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
        monitorIncidents: { list: vi.fn(async () => []) },
        monitorMetrics: {
          activity: vi.fn(async () => []),
          get: vi.fn(async () => null),
          runs: vi.fn(async () => null),
        },
        monitorLifecycle: {
          delete: vi.fn(async () => true),
          pause: vi.fn(async () => true),
          resume: vi.fn(async () => true),
        },
        monitorRead: {
          get: vi.fn(async () => null),
          list: vi.fn(async () => []),
        },
        principal: { tenantId: 'tenant-a', userId: 'user-a' },
        monitorSchedule: { execute: vi.fn(async () => true) },
        rotateToken: { execute: vi.fn(async () => null) },
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
        monitorIncidents: { list: vi.fn(async () => []) },
        monitorMetrics: {
          activity: vi.fn(async () => []),
          get: vi.fn(async () => null),
          runs: vi.fn(async () => null),
        },
        monitorLifecycle: {
          delete: vi.fn(async () => true),
          pause: vi.fn(async () => true),
          resume: vi.fn(async () => true),
        },
        monitorRead: {
          get: vi.fn(async () => {
            throw new Error('database unavailable')
          }),
          list: vi.fn(async () => {
            throw new Error('database unavailable')
          }),
        },
        principal: { tenantId: 'tenant-a', userId: 'user-a' },
        monitorSchedule: { execute: vi.fn(async () => true) },
        rotateToken: { execute: vi.fn(async () => null) },
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

describe('monitor lifecycle routes', () => {
  it('pauses and resumes a tenant-scoped monitor', async () => {
    const { app, pause, resume } = createRoutes({
      tenantId: 'tenant-a',
      userId: 'user-a',
    })

    const pauseResponse = await app.request(
      '/api/monitors/20000000-0000-4000-8000-000000000001/pause',
      { method: 'POST' },
    )
    const resumeResponse = await app.request(
      '/api/monitors/20000000-0000-4000-8000-000000000001/resume',
      { method: 'POST' },
    )

    expect(pauseResponse.status).toBe(204)
    expect(resumeResponse.status).toBe(204)
    expect(pause).toHaveBeenCalledWith('20000000-0000-4000-8000-000000000001')
    expect(resume).toHaveBeenCalledWith('20000000-0000-4000-8000-000000000001')
  })

  it('deletes a monitor after an explicit confirmation path', async () => {
    const { app, remove } = createRoutes({
      tenantId: 'tenant-a',
      userId: 'user-a',
    })
    const response = await app.request(
      '/api/monitors/20000000-0000-4000-8000-000000000001',
      { method: 'DELETE' },
    )

    expect(response.status).toBe(204)
    expect(remove).toHaveBeenCalledWith('20000000-0000-4000-8000-000000000001')
  })

  it('lists incident history for a monitor', async () => {
    const { app, listIncidents } = createRoutes({
      tenantId: 'tenant-a',
      userId: 'user-a',
    })
    const response = await app.request(
      '/api/monitors/20000000-0000-4000-8000-000000000001/incidents',
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        incidents: [
          {
            id: '60000000-0000-4000-8000-000000000001',
            monitorId: '20000000-0000-4000-8000-000000000001',
            openedAt: '2026-01-01T00:00:00.000Z',
            reason: 'heartbeat_missed',
            resolutionReason: null,
            resolvedAt: null,
          },
        ],
      },
    })
    expect(listIncidents).toHaveBeenCalledWith(
      '20000000-0000-4000-8000-000000000001',
    )
  })
})

describe('PATCH /api/monitors/:monitorId', () => {
  const MONITOR_URL = '/api/monitors/20000000-0000-4000-8000-000000000001'
  const principal = { tenantId: 'tenant-a', userId: 'user-a' }

  function patch(
    app: ReturnType<typeof createRoutes>['app'],
    body: unknown,
    url = MONITOR_URL,
  ) {
    return app.request(url, {
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    })
  }

  it('updates the schedule for the authenticated tenant and returns the monitor', async () => {
    const { app, get, updateSchedule } = createRoutes(principal)
    const response = await patch(app, {
      graceSeconds: 60,
      intervalSeconds: 900,
    })

    expect(response.status).toBe(200)
    expect(updateSchedule).toHaveBeenCalledWith({
      graceSeconds: 60,
      intervalSeconds: 900,
      monitorId: '20000000-0000-4000-8000-000000000001',
    })
    expect(get).toHaveBeenCalledWith(
      'tenant-a',
      '20000000-0000-4000-8000-000000000001',
    )
    await expect(response.json()).resolves.toMatchObject({
      data: { monitor: { id: MONITOR_STATE.id, status: 'pending' } },
    })
  })

  it('switches a monitor to a cron schedule and maps invalid expressions to 422', async () => {
    const { app, updateSchedule } = createRoutes(principal)
    const body = {
      cron: '*/5 * * * *',
      graceSeconds: 60,
      timezone: 'UTC',
    }

    expect((await patch(app, body)).status).toBe(200)
    expect(updateSchedule).toHaveBeenCalledWith({
      cron: { expression: '*/5 * * * *', timezone: 'UTC' },
      graceSeconds: 60,
      monitorId: '20000000-0000-4000-8000-000000000001',
    })

    updateSchedule.mockRejectedValueOnce(new InvalidCronError('bad'))
    const invalid = await patch(app, body)

    expect(invalid.status).toBe(422)
    await expect(invalid.json()).resolves.toMatchObject({
      error: { code: 'invalid_cron' },
    })
  })

  it('requires authentication', async () => {
    const { app, updateSchedule } = createRoutes()
    const response = await patch(app, {
      graceSeconds: 60,
      intervalSeconds: 900,
    })

    expect(response.status).toBe(401)
    expect(updateSchedule).not.toHaveBeenCalled()
  })

  it.each([
    { graceSeconds: 60, intervalSeconds: 30 },
    { graceSeconds: -1, intervalSeconds: 900 },
    { graceSeconds: 60 },
    { graceSeconds: 60, intervalSeconds: 900, tenantId: 'tenant-b' },
  ])(
    'rejects the invalid body %j without calling the use case',
    async (body) => {
      const { app, updateSchedule } = createRoutes(principal)
      const response = await patch(app, body)

      expect(response.status).toBe(422)
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'validation_error' },
      })
      expect(updateSchedule).not.toHaveBeenCalled()
    },
  )

  it('rejects a body that is not JSON', async () => {
    const { app, updateSchedule } = createRoutes(principal)
    const response = await patch(app, '{not json')

    expect(response.status).toBe(400)
    expect(updateSchedule).not.toHaveBeenCalled()
  })

  it('returns 404 for a malformed id or a monitor the tenant cannot see', async () => {
    const { app, get, updateSchedule } = createRoutes(principal)
    const body = { graceSeconds: 60, intervalSeconds: 900 }

    expect((await patch(app, body, '/api/monitors/not-a-uuid')).status).toBe(
      404,
    )
    expect(updateSchedule).not.toHaveBeenCalled()

    updateSchedule.mockResolvedValueOnce(false)
    expect((await patch(app, body)).status).toBe(404)
    expect(get).not.toHaveBeenCalled()
  })

  it('maps domain violations to 422 and provider failures to a generic 500', async () => {
    const { app, updateSchedule } = createRoutes(principal)
    const body = { graceSeconds: 60, intervalSeconds: 900 }

    updateSchedule.mockRejectedValueOnce(new RangeError('bad'))
    expect((await patch(app, body)).status).toBe(422)

    updateSchedule.mockRejectedValueOnce(new Error('permission denied'))
    const failed = await patch(app, body)

    expect(failed.status).toBe(500)
    expect(JSON.stringify(await failed.json())).not.toContain(
      'permission denied',
    )
  })
})

describe('POST /api/monitors/:monitorId/rotate-token', () => {
  it('returns the new token only in the authenticated response', async () => {
    const { app, rotateToken } = createRoutes({
      tenantId: 'tenant-a',
      userId: 'user-a',
    })
    const response = await app.request(
      '/api/monitors/20000000-0000-4000-8000-000000000001/rotate-token',
      { method: 'POST' },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { heartbeatToken: 'new-raw-token' },
    })
    expect(rotateToken).toHaveBeenCalledWith(
      '20000000-0000-4000-8000-000000000001',
    )
  })

  it('returns 404 without leaking whether a foreign monitor exists', async () => {
    const app = createMonitorRoutes({
      authenticate: async () => ({
        createMonitor: { execute: vi.fn() },
        monitorIncidents: { list: vi.fn(async () => []) },
        monitorMetrics: {
          activity: vi.fn(async () => []),
          get: vi.fn(async () => null),
          runs: vi.fn(async () => null),
        },
        monitorLifecycle: {
          delete: vi.fn(async () => true),
          pause: vi.fn(async () => true),
          resume: vi.fn(async () => true),
        },
        monitorRead: {
          get: vi.fn(async () => null),
          list: vi.fn(async () => []),
        },
        principal: { tenantId: 'tenant-a', userId: 'user-a' },
        monitorSchedule: { execute: vi.fn(async () => true) },
        rotateToken: { execute: vi.fn(async () => null) },
      }),
    })
    const response = await app.request(
      '/api/monitors/20000000-0000-4000-8000-000000000001/rotate-token',
      { method: 'POST' },
    )

    expect(response.status).toBe(404)
  })
})

describe('GET /api/monitors/activity', () => {
  it('groups daily pings by monitor for the authenticated tenant', async () => {
    const activity = vi.fn(async () => [
      { day: '2026-10-30', monitorId: 'm1', pings: 2 },
      { day: '2026-10-31', monitorId: 'm1', pings: 3 },
      { day: '2026-10-31', monitorId: 'm2', pings: 1 },
    ])
    const app = createMonitorRoutes({
      authenticate: async () =>
        ({
          monitorMetrics: { activity, get: vi.fn(), runs: vi.fn() },
          principal: { tenantId: 'tenant-a', userId: 'u' },
        }) as never,
    })
    const response = await app.request('/api/monitors/activity')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        monitors: [
          {
            days: [
              { day: '2026-10-30', pings: 2 },
              { day: '2026-10-31', pings: 3 },
            ],
            monitorId: 'm1',
          },
          { days: [{ day: '2026-10-31', pings: 1 }], monitorId: 'm2' },
        ],
      },
    })
    expect(activity).toHaveBeenCalledWith('tenant-a')
  })

  it('requires authentication and hides failures', async () => {
    expect(
      (
        await createMonitorRoutes({ authenticate: async () => null }).request(
          '/api/monitors/activity',
        )
      ).status,
    ).toBe(401)

    const failing = createMonitorRoutes({
      authenticate: async () =>
        ({
          monitorMetrics: {
            activity: async () => {
              throw new Error('db')
            },
          },
          principal: { tenantId: 't', userId: 'u' },
        }) as never,
    })

    expect((await failing.request('/api/monitors/activity')).status).toBe(500)
  })
})

describe('GET /api/monitors/:monitorId/metrics', () => {
  const ID = '20000000-0000-4000-8000-000000000001'

  function metricsApp(get: () => Promise<unknown>) {
    return createMonitorRoutes({
      authenticate: async () =>
        ({
          monitorMetrics: {
            activity: vi.fn(async () => []),
            get,
            runs: vi.fn(async () => null),
          },
          principal: { tenantId: 'tenant-a', userId: 'u' },
        }) as never,
    })
  }

  it('returns daily counters for a monitor of the tenant', async () => {
    const metrics = { days: [], totalPings: 7 }
    const response = await metricsApp(async () => metrics).request(
      `/api/monitors/${ID}/metrics`,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: metrics })
  })

  it('answers 404 for unknown or malformed ids and 500 on failures', async () => {
    expect(
      (
        await metricsApp(async () => null).request(
          `/api/monitors/${ID}/metrics`,
        )
      ).status,
    ).toBe(404)
    expect(
      (await metricsApp(async () => null).request('/api/monitors/x/metrics'))
        .status,
    ).toBe(404)
    expect(
      (
        await metricsApp(async () => {
          throw new Error('db')
        }).request(`/api/monitors/${ID}/metrics`)
      ).status,
    ).toBe(500)
  })

  it('requires authentication', async () => {
    const app = createMonitorRoutes({ authenticate: async () => null })

    expect((await app.request(`/api/monitors/${ID}/metrics`)).status).toBe(401)
  })
})

describe('GET /api/monitors/:monitorId/runs', () => {
  const ID = '20000000-0000-4000-8000-000000000001'

  function runsApp(runs: () => Promise<unknown>) {
    return createMonitorRoutes({
      authenticate: async () =>
        ({
          monitorMetrics: { runs },
          principal: { tenantId: 'tenant-a', userId: 'u' },
        }) as never,
    })
  }

  it('returns the run history without any output', async () => {
    const response = await runsApp(async () => [
      {
        createdAtMs: Date.parse('2026-10-31T12:00:00.000Z'),
        durationMs: 1200,
        id: '30000000-0000-4000-8000-000000000001',
        kind: 'success',
        overlapped: false,
      },
    ]).request(`/api/monitors/${ID}/runs`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        runs: [
          {
            createdAt: '2026-10-31T12:00:00.000Z',
            durationMs: 1200,
            id: '30000000-0000-4000-8000-000000000001',
            kind: 'success',
            overlapped: false,
          },
        ],
      },
    })
  })

  it('answers 404, 401 and 500 safely', async () => {
    expect(
      (await runsApp(async () => null).request(`/api/monitors/${ID}/runs`))
        .status,
    ).toBe(404)
    expect(
      (await runsApp(async () => null).request('/api/monitors/x/runs')).status,
    ).toBe(404)
    expect(
      (
        await runsApp(async () => {
          throw new Error('db')
        }).request(`/api/monitors/${ID}/runs`)
      ).status,
    ).toBe(500)
    expect(
      (
        await createMonitorRoutes({ authenticate: async () => null }).request(
          `/api/monitors/${ID}/runs`,
        )
      ).status,
    ).toBe(401)
  })
})
