import { describe, expect, it, vi } from 'vitest'

import {
  MaintenanceLimitError,
  MaintenanceMonitorNotFoundError,
} from '../../../application/maintenance.ts'
import { createMaintenanceRoutes } from './maintenance-routes.ts'

const WINDOW = {
  endsAt: '2026-11-02T04:00:00.000Z',
  id: '50000000-0000-4000-8000-000000000001',
  monitorId: null,
  name: 'Migration',
  startsAt: '2026-11-02T02:00:00.000Z',
}
const BODY = {
  endsAt: WINDOW.endsAt,
  monitorId: null,
  name: 'Migration',
  startsAt: WINDOW.startsAt,
}

function setup(authenticated = true) {
  const list = vi.fn(async () => [WINDOW])
  const create = vi.fn(async () => WINDOW)
  const remove = vi.fn(async () => true)
  const app = createMaintenanceRoutes({
    authenticate: async () =>
      authenticated
        ? { maintenance: { create, list, remove }, tenantId: 'tenant-a' }
        : null,
  })
  const post = (body: unknown) =>
    app.request('/api/maintenance', {
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

  return { app, create, list, post, remove }
}

describe('maintenance routes', () => {
  it('requires authentication on every route', async () => {
    const { app, post } = setup(false)

    expect((await app.request('/api/maintenance')).status).toBe(401)
    expect((await post(BODY)).status).toBe(401)
    expect(
      (await app.request(`/api/maintenance/${WINDOW.id}`, { method: 'DELETE' }))
        .status,
    ).toBe(401)
  })

  it('lists and creates windows for the principal tenant only', async () => {
    const { app, create, list, post } = setup()

    await expect(
      (await app.request('/api/maintenance')).json(),
    ).resolves.toEqual({ data: { windows: [WINDOW] } })
    expect(list).toHaveBeenCalledWith('tenant-a')
    expect((await post(BODY)).status).toBe(201)
    expect(create).toHaveBeenCalledWith('tenant-a', BODY)
  })

  it('rejects malformed bodies, invalid windows and a client tenant', async () => {
    const { create, post } = setup()

    expect((await post('{')).status).toBe(400)
    expect((await post({ ...BODY, endsAt: BODY.startsAt })).status).toBe(422)
    expect((await post({ ...BODY, tenantId: 'other' })).status).toBe(422)
    expect(create).not.toHaveBeenCalled()
  })

  it('maps domain failures and hides provider errors', async () => {
    const { create, post } = setup()

    create.mockRejectedValueOnce(new MaintenanceLimitError())
    expect((await post(BODY)).status).toBe(409)
    create.mockRejectedValueOnce(new MaintenanceMonitorNotFoundError())
    expect((await post(BODY)).status).toBe(404)
    create.mockRejectedValueOnce(new Error('permission denied'))
    const failed = await post(BODY)

    expect(failed.status).toBe(500)
    expect(JSON.stringify(await failed.json())).not.toContain('denied')
  })

  it('deletes a window, with 404 for an unknown or invalid id', async () => {
    const { app, remove } = setup()
    const del = (id: string) =>
      app.request(`/api/maintenance/${id}`, { method: 'DELETE' })

    expect((await del(WINDOW.id)).status).toBe(204)
    expect(remove).toHaveBeenCalledWith('tenant-a', WINDOW.id)
    remove.mockResolvedValueOnce(false)
    expect((await del(WINDOW.id)).status).toBe(404)
    expect((await del('nope')).status).toBe(404)
  })
})
