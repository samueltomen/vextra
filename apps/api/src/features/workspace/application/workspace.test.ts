import { describe, expect, it, vi } from 'vitest'

import {
  AccountPreferencesService,
  DEFAULT_PREFERENCES,
  ManageFolders,
  type FolderPort,
  type PreferencesPort,
} from './workspace.ts'

function folderPort(): FolderPort {
  return {
    assign: vi.fn(async () => true),
    create: vi.fn(async (_tenantId, name) => ({ id: 'f1', name })),
    list: vi.fn(async () => [{ id: 'f1', name: 'Prod' }]),
    remove: vi.fn(async () => true),
    rename: vi.fn(async (_tenantId, id, name) => ({ id, name })),
  }
}

describe('ManageFolders', () => {
  it('delegates every operation to the port with the tenant', async () => {
    const port = folderPort()
    const folders = new ManageFolders(port)

    await folders.create('t', 'Prod')
    await folders.list('t')
    await folders.rename('t', 'f1', 'Staging')
    await folders.remove('t', 'f1')
    await folders.assign('t', 'm1', 'f1')

    expect(port.create).toHaveBeenCalledWith('t', 'Prod')
    expect(port.list).toHaveBeenCalledWith('t')
    expect(port.rename).toHaveBeenCalledWith('t', 'f1', 'Staging')
    expect(port.remove).toHaveBeenCalledWith('t', 'f1')
    expect(port.assign).toHaveBeenCalledWith('t', 'm1', 'f1')
  })
})

describe('AccountPreferencesService', () => {
  function port(current: Awaited<ReturnType<PreferencesPort['find']>>) {
    return {
      find: vi.fn(async () => current),
      insert: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
    } satisfies PreferencesPort
  }

  it('returns defaults when nothing is stored', async () => {
    const service = new AccountPreferencesService(port(null))

    await expect(service.get('t')).resolves.toEqual(DEFAULT_PREFERENCES)
  })

  it('creates the row on the first change and merges defaults', async () => {
    const preferences = port(null)
    const service = new AccountPreferencesService(preferences)

    await expect(
      service.update('t', { notifyOnResolve: false }),
    ).resolves.toEqual({ ...DEFAULT_PREFERENCES, notifyOnResolve: false })
    expect(preferences.insert).toHaveBeenCalledOnce()
    expect(preferences.update).not.toHaveBeenCalled()
  })

  it('only updates the changed columns afterwards', async () => {
    const preferences = port({ ...DEFAULT_PREFERENCES, displayName: 'Ada' })
    const service = new AccountPreferencesService(preferences)

    await expect(
      service.update('t', { timezone: 'Asia/Tokyo' }),
    ).resolves.toEqual({
      ...DEFAULT_PREFERENCES,
      displayName: 'Ada',
      timezone: 'Asia/Tokyo',
    })
    expect(preferences.update).toHaveBeenCalledWith('t', {
      timezone: 'Asia/Tokyo',
    })
    expect(preferences.insert).not.toHaveBeenCalled()
  })
})
