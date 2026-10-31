import { describe, expect, it, vi } from 'vitest'

import {
  FolderLimitError,
  FolderNameTakenError,
  FolderNotFoundError,
  DEFAULT_PREFERENCES,
} from '../../../application/workspace.ts'
import {
  createWorkspaceRoutes,
  type WorkspaceScope,
} from './workspace-routes.ts'

const FOLDER_ID = '30000000-0000-4000-8000-000000000001'
const MONITOR_ID = '20000000-0000-4000-8000-000000000001'

function scope(overrides: Partial<WorkspaceScope['folders']> = {}) {
  return {
    folders: {
      assign: vi.fn(async () => true),
      create: vi.fn(async (_tenant: string, name: string) => ({
        id: FOLDER_ID,
        name,
      })),
      list: vi.fn(async () => [{ id: FOLDER_ID, name: 'Prod' }]),
      remove: vi.fn(async () => true),
      rename: vi.fn(async (_t: string, id: string, name: string) => ({
        id,
        name,
      })),
      ...overrides,
    },
    preferences: {
      get: vi.fn(async () => DEFAULT_PREFERENCES),
      update: vi.fn(async (_t: string, changes: object) => ({
        ...DEFAULT_PREFERENCES,
        ...changes,
      })),
    },
    tenantId: 'tenant-a',
  } satisfies WorkspaceScope
}

function app(current: WorkspaceScope | null = scope()) {
  return createWorkspaceRoutes({ authenticate: async () => current })
}

function json(method: string, body: unknown) {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method,
  }
}

describe('workspace routes authentication', () => {
  it.each([
    ['GET', '/api/folders'],
    ['POST', '/api/folders'],
    ['PATCH', `/api/folders/${FOLDER_ID}`],
    ['DELETE', `/api/folders/${FOLDER_ID}`],
    ['PUT', `/api/monitors/${MONITOR_ID}/folder`],
    ['GET', '/api/preferences'],
    ['PATCH', '/api/preferences'],
  ])('requires a session for %s %s', async (method, path) => {
    const response = await app(null).request(path, { method })

    expect(response.status).toBe(401)
  })
})

describe('folder routes', () => {
  it('lists the folders of the authenticated tenant', async () => {
    const current = scope()
    const response = await app(current).request('/api/folders')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { folders: [{ id: FOLDER_ID, name: 'Prod' }] },
    })
    expect(current.folders.list).toHaveBeenCalledWith('tenant-a')
  })

  it('creates a folder and ignores any tenant supplied by the client', async () => {
    const current = scope()
    const created = await app(current).request(
      '/api/folders',
      json('POST', { name: ' Prod ' }),
    )

    expect(created.status).toBe(201)
    expect(current.folders.create).toHaveBeenCalledWith('tenant-a', 'Prod')

    const rejected = await app(current).request(
      '/api/folders',
      json('POST', { name: 'x', tenantId: 'tenant-b' }),
    )

    expect(rejected.status).toBe(422)
  })

  it('rejects malformed JSON', async () => {
    const response = await app().request('/api/folders', {
      body: '{',
      method: 'POST',
    })

    expect(response.status).toBe(400)
  })

  it('maps domain errors to stable HTTP errors', async () => {
    const cases: Array<[Error, number, string]> = [
      [new FolderNameTakenError(), 409, 'folder_name_taken'],
      [new FolderLimitError(), 409, 'folder_limit_reached'],
      [new FolderNotFoundError(), 404, 'folder_not_found'],
      [new Error('boom'), 500, 'internal_error'],
    ]

    for (const [error, status, code] of cases) {
      const response = await app(
        scope({
          create: vi.fn(async () => {
            throw error
          }),
        }),
      ).request('/api/folders', json('POST', { name: 'Prod' }))

      expect(response.status).toBe(status)
      await expect(response.json()).resolves.toMatchObject({
        error: { code },
      })
    }
  })

  it('renames and deletes folders, answering 404 when nothing matches', async () => {
    const renamed = await app().request(
      `/api/folders/${FOLDER_ID}`,
      json('PATCH', { name: 'Staging' }),
    )

    expect(renamed.status).toBe(200)

    const missing = scope({ rename: vi.fn(async () => null) })

    expect(
      (
        await app(missing).request(
          `/api/folders/${FOLDER_ID}`,
          json('PATCH', { name: 'x' }),
        )
      ).status,
    ).toBe(404)
    expect(
      (
        await app().request(
          '/api/folders/not-a-uuid',
          json('PATCH', { name: 'x' }),
        )
      ).status,
    ).toBe(404)
    expect(
      (await app().request(`/api/folders/${FOLDER_ID}`, { method: 'DELETE' }))
        .status,
    ).toBe(204)
    expect(
      (
        await app(scope({ remove: vi.fn(async () => false) })).request(
          `/api/folders/${FOLDER_ID}`,
          { method: 'DELETE' },
        )
      ).status,
    ).toBe(404)
    expect(
      (await app().request('/api/folders/nope', { method: 'DELETE' })).status,
    ).toBe(404)
  })

  it('files a monitor in a folder, or removes it from its folder', async () => {
    const current = scope()
    const filed = await app(current).request(
      `/api/monitors/${MONITOR_ID}/folder`,
      json('PUT', { folderId: FOLDER_ID }),
    )

    expect(filed.status).toBe(204)
    expect(current.folders.assign).toHaveBeenCalledWith(
      'tenant-a',
      MONITOR_ID,
      FOLDER_ID,
    )

    await app(current).request(
      `/api/monitors/${MONITOR_ID}/folder`,
      json('PUT', { folderId: null }),
    )
    expect(current.folders.assign).toHaveBeenLastCalledWith(
      'tenant-a',
      MONITOR_ID,
      null,
    )

    expect(
      (
        await app(scope({ assign: vi.fn(async () => false) })).request(
          `/api/monitors/${MONITOR_ID}/folder`,
          json('PUT', { folderId: null }),
        )
      ).status,
    ).toBe(404)
    expect(
      (
        await app().request(
          '/api/monitors/nope/folder',
          json('PUT', { folderId: null }),
        )
      ).status,
    ).toBe(404)
    expect(
      (
        await app().request(
          `/api/monitors/${MONITOR_ID}/folder`,
          json('PUT', { folderId: 'bad' }),
        )
      ).status,
    ).toBe(422)
  })
})

describe('preference routes', () => {
  it('returns the preferences of the tenant', async () => {
    const response = await app().request('/api/preferences')

    await expect(response.json()).resolves.toEqual({
      data: { preferences: DEFAULT_PREFERENCES },
    })
  })

  it('applies a validated partial update', async () => {
    const current = scope()
    const response = await app(current).request(
      '/api/preferences',
      json('PATCH', { notifyOnResolve: false }),
    )

    expect(response.status).toBe(200)
    expect(current.preferences.update).toHaveBeenCalledWith('tenant-a', {
      notifyOnResolve: false,
    })
  })

  it('rejects empty, unknown and invalid updates', async () => {
    for (const body of [{}, { tenantId: 'x' }, { timezone: 'Mars/Olympus' }]) {
      const response = await app().request(
        '/api/preferences',
        json('PATCH', body),
      )

      expect(response.status).toBe(422)
    }
  })
})
