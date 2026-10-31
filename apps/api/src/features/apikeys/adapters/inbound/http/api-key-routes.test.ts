import { describe, expect, it, vi } from 'vitest'

import type { MonitorStateRecord } from '../../../../monitoring/application/monitor-read.ts'
import {
  ApiKeyForbiddenError,
  ApiKeyLimitError,
} from '../../../application/api-keys.ts'
import { createApiKeyRoutes } from './api-key-routes.ts'

const VIEW = {
  createdAt: '2026-10-31T12:00:00.000Z',
  id: '60000000-0000-4000-8000-000000000001',
  lastUsedAt: null,
  name: 'CI',
  prefix: 'vx_abcdef1',
  revokedAt: null,
}
const MONITOR: MonitorStateRecord = {
  alertAtMs: 0,
  alertsEnabled: true,
  createdAtMs: 0,
  cronExpression: null,
  cronTimezone: null,
  description: null,
  folderId: null,
  graceSeconds: 60,
  id: '20000000-0000-4000-8000-000000000001',
  incidentOpenedAtMs: null,
  intervalSeconds: 300,
  lastHeartbeatAtMs: null,
  name: 'API',
  notes: null,
  pausedAtMs: null,
  runningSinceMs: null,
  status: 'healthy',
  tags: [],
  tenantId: 'tenant-a',
  totalPings: 0,
}
const KEY = `vx_${'A'.repeat(43)}`

function setup(authenticated = true) {
  const create = vi.fn(async () => ({ apiKey: VIEW, key: KEY }))
  const list = vi.fn(async () => [VIEW])
  const revoke = vi.fn(async () => true)
  const tenantFor = vi.fn(async (key: string) =>
    key === KEY ? 'tenant-a' : null,
  )
  const monitorList = vi.fn(async () => [MONITOR])
  const monitorGet = vi.fn(
    async (): Promise<MonitorStateRecord | null> => MONITOR,
  )
  const app = createApiKeyRoutes({
    authenticate: async () =>
      authenticated
        ? { keys: { create, list, revoke }, tenantId: 'tenant-a' }
        : null,
    authenticator: { tenantFor },
    monitors: { get: monitorGet, list: monitorList },
  })
  const post = (body: unknown) =>
    app.request('/api/api-keys', {
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

  return { app, create, list, monitorGet, monitorList, post, revoke, tenantFor }
}

const bearer = (key: string) => ({
  headers: { authorization: `Bearer ${key}` },
})

describe('API key management routes', () => {
  it('requires a session', async () => {
    const { app, post } = setup(false)

    expect((await app.request('/api/api-keys')).status).toBe(401)
    expect((await post({ name: 'CI' })).status).toBe(401)
  })

  it('lists, creates and revokes keys for the session tenant', async () => {
    const { app, create, list, post, revoke } = setup()

    await expect((await app.request('/api/api-keys')).json()).resolves.toEqual({
      data: { keys: [VIEW] },
    })
    expect(list).toHaveBeenCalledWith('tenant-a')
    const created = await post({ name: 'CI' })

    expect(created.status).toBe(201)
    await expect(created.json()).resolves.toEqual({
      data: { apiKey: VIEW, key: KEY },
    })
    expect(create).toHaveBeenCalledWith('tenant-a', 'CI')
    expect(
      (await app.request(`/api/api-keys/${VIEW.id}`, { method: 'DELETE' }))
        .status,
    ).toBe(204)
    expect(revoke).toHaveBeenCalledWith('tenant-a', VIEW.id)
  })

  it('rejects bad input, maps the limit and hides provider failures', async () => {
    const { app, create, post, revoke } = setup()

    expect((await post('{')).status).toBe(400)
    expect((await post({ name: '' })).status).toBe(422)
    expect((await post({ name: 'CI', tenantId: 'x' })).status).toBe(422)
    create.mockRejectedValueOnce(new ApiKeyLimitError())
    expect((await post({ name: 'CI' })).status).toBe(409)
    create.mockRejectedValueOnce(new ApiKeyForbiddenError())
    expect((await post({ name: 'CI' })).status).toBe(403)
    create.mockRejectedValueOnce(new Error('permission denied'))
    const failed = await post({ name: 'CI' })

    expect(failed.status).toBe(500)
    expect(JSON.stringify(await failed.json())).not.toContain('denied')
    revoke.mockResolvedValueOnce(false)
    expect(
      (await app.request(`/api/api-keys/${VIEW.id}`, { method: 'DELETE' }))
        .status,
    ).toBe(404)
    expect(
      (await app.request('/api/api-keys/nope', { method: 'DELETE' })).status,
    ).toBe(404)
  })
})

describe('read-only public API', () => {
  it('rejects missing, malformed and unknown keys', async () => {
    const { app } = setup()

    expect((await app.request('/api/v1/monitors')).status).toBe(401)
    expect(
      (
        await app.request('/api/v1/monitors', {
          headers: { authorization: 'Basic x' },
        })
      ).status,
    ).toBe(401)
    expect(
      (await app.request('/api/v1/monitors', bearer('vx_wrong'))).status,
    ).toBe(401)
  })

  it('does not accept the session cookie as credentials', async () => {
    const { app, monitorList } = setup()
    const response = await app.request('/api/v1/monitors', {
      headers: { cookie: '__Host-vextra_session=abc' },
    })

    expect(response.status).toBe(401)
    expect(monitorList).not.toHaveBeenCalled()
  })

  it('lists and reads monitors of the key tenant only', async () => {
    const { app, monitorGet, monitorList } = setup()
    const list = await app.request('/api/v1/monitors', bearer(KEY))

    expect(list.status).toBe(200)
    expect(monitorList).toHaveBeenCalledWith('tenant-a')
    const one = await app.request(`/api/v1/monitors/${MONITOR.id}`, bearer(KEY))

    expect(one.status).toBe(200)
    expect(monitorGet).toHaveBeenCalledWith('tenant-a', MONITOR.id)
  })

  it('returns 404 for an unknown or malformed monitor id', async () => {
    const { app, monitorGet } = setup()

    monitorGet.mockResolvedValueOnce(null)
    expect(
      (await app.request(`/api/v1/monitors/${MONITOR.id}`, bearer(KEY))).status,
    ).toBe(404)
    expect(
      (await app.request('/api/v1/monitors/nope', bearer(KEY))).status,
    ).toBe(404)
  })

  it('hides authentication backend failures', async () => {
    const { app, tenantFor } = setup()

    tenantFor.mockRejectedValueOnce(new Error('db down'))
    const response = await app.request('/api/v1/monitors', bearer(KEY))

    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('db down')
  })
})
