import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  FolderLimitError,
  FolderNameTakenError,
  FolderNotFoundError,
} from '../../application/workspace.ts'
import {
  SupabaseFolderRepository,
  SupabasePreferencesRepository,
} from './supabase-workspace.ts'

type Result = Readonly<{
  data?: unknown
  error?: Readonly<{ code?: string }> | null
}>

function client(result: Result) {
  const calls: Array<[string, unknown[]]> = []
  const chain: Record<string, unknown> = {}
  const resolved = { data: result.data ?? null, error: result.error ?? null }

  for (const method of [
    'from',
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'order',
  ]) {
    chain[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args])

      return chain
    })
  }

  chain['single'] = vi.fn(async () => resolved)
  chain['maybeSingle'] = vi.fn(async () => resolved)
  chain['then'] = (resolve: (value: typeof resolved) => unknown) =>
    Promise.resolve(resolved).then(resolve)

  return { calls, supabase: chain as unknown as SupabaseClient }
}

describe('SupabaseFolderRepository', () => {
  it('lists folders of the tenant sorted by name', async () => {
    const { calls, supabase } = client({ data: [{ id: 'f1', name: 'Prod' }] })

    await expect(
      new SupabaseFolderRepository(supabase).list('tenant-a'),
    ).resolves.toEqual([{ id: 'f1', name: 'Prod' }])
    expect(calls).toContainEqual(['eq', ['tenant_id', 'tenant-a']])
  })

  it('creates and renames within the tenant', async () => {
    const created = client({ data: { id: 'f1', name: 'Prod' } })

    await expect(
      new SupabaseFolderRepository(created.supabase).create('tenant-a', 'Prod'),
    ).resolves.toEqual({ id: 'f1', name: 'Prod' })
    expect(created.calls).toContainEqual([
      'insert',
      [{ name: 'Prod', tenant_id: 'tenant-a' }],
    ])

    const renamed = client({ data: { id: 'f1', name: 'Staging' } })

    await expect(
      new SupabaseFolderRepository(renamed.supabase).rename(
        'tenant-a',
        'f1',
        'Staging',
      ),
    ).resolves.toEqual({ id: 'f1', name: 'Staging' })
    expect(renamed.calls).toContainEqual(['eq', ['tenant_id', 'tenant-a']])

    const missing = client({ data: null })

    await expect(
      new SupabaseFolderRepository(missing.supabase).rename('t', 'f', 'x'),
    ).resolves.toBeNull()
  })

  it('reports whether a delete or an assignment touched a row', async () => {
    const hit = client({ data: [{ id: 'x' }] })
    const miss = client({ data: [] })

    await expect(
      new SupabaseFolderRepository(hit.supabase).remove('t', 'f'),
    ).resolves.toBe(true)
    await expect(
      new SupabaseFolderRepository(miss.supabase).remove('t', 'f'),
    ).resolves.toBe(false)
    await expect(
      new SupabaseFolderRepository(hit.supabase).assign('t', 'm', 'f'),
    ).resolves.toBe(true)
    expect(hit.calls).toContainEqual(['update', [{ folder_id: 'f' }]])
    await expect(
      new SupabaseFolderRepository(miss.supabase).assign('t', 'm', null),
    ).resolves.toBe(false)
  })

  it('maps Postgres error codes to domain errors', async () => {
    const repo = (code: string) =>
      new SupabaseFolderRepository(client({ error: { code } }).supabase)

    await expect(repo('23505').create('t', 'x')).rejects.toBeInstanceOf(
      FolderNameTakenError,
    )
    await expect(repo('54000').create('t', 'x')).rejects.toBeInstanceOf(
      FolderLimitError,
    )
    await expect(repo('23503').assign('t', 'm', 'f')).rejects.toBeInstanceOf(
      FolderNotFoundError,
    )
    await expect(repo('XX000').list('t')).rejects.toThrow('folder query failed')
  })
})

describe('SupabasePreferencesRepository', () => {
  const ROW = {
    display_name: 'Ada',
    notify_on_open: true,
    notify_on_resolve: false,
    timezone: 'Asia/Tokyo',
  }

  it('reads and maps preferences', async () => {
    await expect(
      new SupabasePreferencesRepository(client({ data: ROW }).supabase).find(
        't',
      ),
    ).resolves.toEqual({
      displayName: 'Ada',
      notifyOnOpen: true,
      notifyOnResolve: false,
      timezone: 'Asia/Tokyo',
    })
    await expect(
      new SupabasePreferencesRepository(client({ data: null }).supabase).find(
        't',
      ),
    ).resolves.toBeNull()
  })

  it('writes only the provided columns, scoped to the tenant', async () => {
    const updated = client({})

    await new SupabasePreferencesRepository(updated.supabase).update('t', {
      notifyOnOpen: false,
    })
    expect(updated.calls).toContainEqual([
      'update',
      [{ notify_on_open: false }],
    ])
    expect(updated.calls).toContainEqual(['eq', ['tenant_id', 't']])

    const inserted = client({})

    await new SupabasePreferencesRepository(inserted.supabase).insert('t', {
      displayName: null,
      notifyOnOpen: true,
      notifyOnResolve: true,
      timezone: 'Europe/Paris',
    })
    expect(inserted.calls).toContainEqual([
      'insert',
      [
        {
          display_name: null,
          notify_on_open: true,
          notify_on_resolve: true,
          tenant_id: 't',
          timezone: 'Europe/Paris',
        },
      ],
    ])
  })

  it('fails closed on database errors', async () => {
    const failing = () =>
      new SupabasePreferencesRepository(
        client({ error: { code: 'XX000' } }).supabase,
      )

    await expect(failing().find('t')).rejects.toThrow(
      'preferences query failed',
    )
    await expect(failing().update('t', {})).rejects.toThrow(
      'preferences update failed',
    )
    await expect(
      failing().insert('t', {
        displayName: null,
        notifyOnOpen: true,
        notifyOnResolve: true,
        timezone: 'UTC',
      }),
    ).rejects.toThrow('preferences insert failed')
  })
})
