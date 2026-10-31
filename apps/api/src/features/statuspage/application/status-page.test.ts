import { describe, expect, it, vi } from 'vitest'

import {
  ManageStatusPage,
  ReadPublicStatusPage,
  type SaveStatusPageInput,
  type StatusPageSettingsPort,
} from './status-page.ts'

const INPUT: SaveStatusPageInput = {
  description: null,
  enabled: true,
  monitorIds: ['a', 'b', 'a'],
  slug: 'acme',
  title: 'Acme',
}

describe('ManageStatusPage', () => {
  it('deduplicates the selected monitors and returns the stored settings', async () => {
    const stored = { monitorIds: ['a', 'b'], page: null }
    const port = {
      get: vi.fn(async () => stored),
      save: vi.fn(async () => undefined),
    } satisfies StatusPageSettingsPort

    await expect(new ManageStatusPage(port).save('t1', INPUT)).resolves.toBe(
      stored,
    )
    expect(port.save).toHaveBeenCalledWith('t1', {
      ...INPUT,
      monitorIds: ['a', 'b'],
    })
  })

  it('reads the settings of the tenant', async () => {
    const stored = { monitorIds: [], page: null }
    const port = { get: vi.fn(async () => stored), save: vi.fn() }

    await expect(new ManageStatusPage(port).get('t1')).resolves.toBe(stored)
    expect(port.get).toHaveBeenCalledWith('t1')
  })
})

describe('ReadPublicStatusPage', () => {
  it('delegates to the public reader', async () => {
    const read = vi.fn(async () => null)

    await expect(new ReadPublicStatusPage({ read }).read('x')).resolves.toBe(
      null,
    )
    expect(read).toHaveBeenCalledWith('x')
  })
})
