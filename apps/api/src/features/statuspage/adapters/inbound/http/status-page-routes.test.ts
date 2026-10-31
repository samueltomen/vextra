import { describe, expect, it, vi } from 'vitest'

import { StatusPageSlugTakenError } from '../../../application/status-page.ts'
import { createStatusPageRoutes } from './status-page-routes.ts'

const SETTINGS = { monitorIds: ['m1'], page: null }
const BODY = {
  description: null,
  enabled: true,
  monitorIds: [],
  slug: 'acme-status',
  title: 'Acme',
}

function setup(authenticated = true) {
  const get = vi.fn(async () => SETTINGS)
  const save = vi.fn(async () => SETTINGS)
  const read = vi.fn(async () => null as object | null)
  const app = createStatusPageRoutes({
    authenticate: async () =>
      authenticated ? { settings: { get, save }, tenantId: 'tenant-a' } : null,
    publicPage: { read: read as never },
  })
  const put = (body: unknown) =>
    app.request('/api/status-page', {
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'PUT',
    })

  return { app, get, put, read, save }
}

describe('status page settings routes', () => {
  it('requires authentication', async () => {
    const { app, put } = setup(false)

    expect((await app.request('/api/status-page')).status).toBe(401)
    expect((await put(BODY)).status).toBe(401)
  })

  it('reads and saves the settings of the principal tenant only', async () => {
    const { app, get, put, save } = setup()

    await expect(
      (await app.request('/api/status-page')).json(),
    ).resolves.toEqual({ data: SETTINGS })
    expect(get).toHaveBeenCalledWith('tenant-a')
    expect((await put(BODY)).status).toBe(200)
    expect(save).toHaveBeenCalledWith('tenant-a', BODY)
  })

  it('rejects invalid bodies and a client supplied tenant', async () => {
    const { put, save } = setup()

    expect((await put('{')).status).toBe(400)
    expect((await put({ ...BODY, slug: 'Bad Slug' })).status).toBe(422)
    expect((await put({ ...BODY, tenantId: 'other' })).status).toBe(422)
    expect(save).not.toHaveBeenCalled()
  })

  it('maps a taken slug to 409 and hides other failures', async () => {
    const { app, get, put, save } = setup()

    save.mockRejectedValueOnce(new StatusPageSlugTakenError())
    expect((await put(BODY)).status).toBe(409)

    save.mockRejectedValueOnce(new Error('permission denied'))
    const failed = await put(BODY)

    expect(failed.status).toBe(500)
    expect(JSON.stringify(await failed.json())).not.toContain('denied')

    get.mockRejectedValueOnce(new Error('db'))
    expect((await app.request('/api/status-page')).status).toBe(500)
  })
})

describe('GET /api/status/:slug', () => {
  it('serves the public page without authentication', async () => {
    const { app, read } = setup(false)

    read.mockResolvedValueOnce({ title: 'Acme' })
    const response = await app.request('/api/status/acme-status')

    expect(response.status).toBe(200)
    expect(read).toHaveBeenCalledWith('acme-status')
  })

  it('returns 404 for an unknown page or an invalid slug', async () => {
    const { app, read } = setup(false)

    expect((await app.request('/api/status/acme-status')).status).toBe(404)
    expect((await app.request('/api/status/Bad_Slug')).status).toBe(404)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('hides provider failures', async () => {
    const { app, read } = setup(false)

    read.mockRejectedValueOnce(new Error('boom'))
    const response = await app.request('/api/status/acme-status')

    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('boom')
  })
})
