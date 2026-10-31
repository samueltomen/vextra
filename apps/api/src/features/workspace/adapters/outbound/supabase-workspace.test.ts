import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  FolderLimitError,
  FolderNameTakenError,
  FolderNotFoundError,
} from '../../application/workspace.ts'
import {
  SupabaseFolderRepository,
  SupabaseMonitorDetailsRepository,
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
    default_folder_id: null,
    default_grace_minutes: 5,
    default_interval_minutes: 60,
    default_sort: 'priority',
    default_view: 'list',
    density: 'compact',
    display_name: 'Ada',
    notify_on_open: true,
    notify_on_resolve: false,
    reminder_interval_minutes: null,
    time_format: '24h',
    timezone: 'Asia/Tokyo',
  }

  it('reads and maps preferences', async () => {
    await expect(
      new SupabasePreferencesRepository(client({ data: ROW }).supabase).find(
        't',
      ),
    ).resolves.toEqual({
      dashboardSort: 'priority',
      dashboardView: 'list',
      defaultFolderId: null,
      defaultGraceMinutes: 5,
      defaultIntervalMinutes: 60,
      density: 'compact',
      displayName: 'Ada',
      notifyOnOpen: true,
      notifyOnResolve: false,
      reminderIntervalMinutes: null,
      timeFormat: '24h',
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
      dashboardSort: 'name',
      dashboardView: 'grid',
      defaultFolderId: 'f1',
      defaultGraceMinutes: 2,
      defaultIntervalMinutes: 15,
      density: 'comfortable',
      displayName: null,
      notifyOnOpen: true,
      notifyOnResolve: true,
      reminderIntervalMinutes: 360,
      timeFormat: '12h',
      timezone: 'Europe/Paris',
    })
    expect(inserted.calls).toContainEqual([
      'insert',
      [
        {
          default_folder_id: 'f1',
          default_grace_minutes: 2,
          default_interval_minutes: 15,
          default_sort: 'name',
          default_view: 'grid',
          density: 'comfortable',
          display_name: null,
          notify_on_open: true,
          notify_on_resolve: true,
          reminder_interval_minutes: 360,
          tenant_id: 't',
          time_format: '12h',
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
        dashboardSort: 'priority',
        dashboardView: 'list',
        defaultFolderId: null,
        defaultGraceMinutes: 5,
        defaultIntervalMinutes: 60,
        density: 'compact',
        displayName: null,
        notifyOnOpen: true,
        notifyOnResolve: true,
        reminderIntervalMinutes: null,
        timeFormat: '24h',
        timezone: 'UTC',
      }),
    ).rejects.toThrow('preferences insert failed')
  })
})

describe('SupabaseMonitorDetailsRepository', () => {
  it('updates only the provided columns, scoped to the tenant', async () => {
    const updated = client({ data: [{ id: 'm1' }] })

    await expect(
      new SupabaseMonitorDetailsRepository(updated.supabase).update('t', 'm1', {
        alertsEnabled: false,
        description: null,
        name: 'Sync',
        notes: 'Runbook',
      }),
    ).resolves.toBe(true)
    expect(updated.calls).toContainEqual([
      'update',
      [
        {
          alerts_enabled: false,
          description: null,
          name: 'Sync',
          notes: 'Runbook',
        },
      ],
    ])
    expect(updated.calls).toContainEqual(['eq', ['tenant_id', 't']])
  })

  it('reports an unknown monitor and fails closed on errors', async () => {
    await expect(
      new SupabaseMonitorDetailsRepository(
        client({ data: [] }).supabase,
      ).update('t', 'm', { name: 'x' }),
    ).resolves.toBe(false)
    await expect(
      new SupabaseMonitorDetailsRepository(
        client({ error: { code: 'x' } }).supabase,
      ).update('t', 'm', { name: 'x' }),
    ).rejects.toThrow('monitor details update failed')
  })
})
