import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { StatusPageSlugTakenError } from '../../application/status-page.ts'
import {
  SupabasePublicStatusPage,
  SupabaseStatusPageSettings,
} from './supabase-status-page.ts'

function tableClient(results: Record<string, unknown>, rpcResult?: object) {
  const from = vi.fn((table: string) => {
    const result = results[table] as object
    const builder: Record<string, unknown> = {}

    builder.select = () => builder
    builder.eq = () => builder
    builder.maybeSingle = async () => result
    builder.then = (resolve: (value: unknown) => void) => resolve(result)

    return builder
  })
  const rpc = vi.fn(async () => rpcResult ?? { data: null, error: null })

  return { client: { from, rpc } as unknown as SupabaseClient, rpc }
}

describe('SupabaseStatusPageSettings', () => {
  it('maps the page and the exposed monitors', async () => {
    const { client } = tableClient({
      monitors: { data: [{ id: 'm1' }], error: null },
      status_pages: {
        data: { description: null, enabled: true, slug: 's', title: 'T' },
        error: null,
      },
    })

    await expect(
      new SupabaseStatusPageSettings(client).get('t1'),
    ).resolves.toEqual({
      monitorIds: ['m1'],
      page: { description: null, enabled: true, slug: 's', title: 'T' },
    })
  })

  it('returns no page when none exists and fails closed on errors', async () => {
    const empty = tableClient({
      monitors: { data: [], error: null },
      status_pages: { data: null, error: null },
    })

    await expect(
      new SupabaseStatusPageSettings(empty.client).get('t1'),
    ).resolves.toEqual({ monitorIds: [], page: null })

    const failing = tableClient({
      monitors: { data: null, error: { code: 'x' } },
      status_pages: { data: null, error: null },
    })

    await expect(
      new SupabaseStatusPageSettings(failing.client).get('t1'),
    ).rejects.toThrow('status page query failed')
  })

  it('saves through the atomic function and maps a taken slug', async () => {
    const ok = tableClient({}, { error: null })
    const input = {
      description: null,
      enabled: true,
      monitorIds: ['m1'],
      slug: 's',
      title: 'T',
    }

    await new SupabaseStatusPageSettings(ok.client).save('t1', input)
    expect(ok.rpc).toHaveBeenCalledWith('save_status_page', {
      p_description: null,
      p_enabled: true,
      p_monitor_ids: ['m1'],
      p_slug: 's',
      p_tenant_id: 't1',
      p_title: 'T',
    })

    const taken = tableClient({}, { error: { code: '23505' } })

    await expect(
      new SupabaseStatusPageSettings(taken.client).save('t1', input),
    ).rejects.toBeInstanceOf(StatusPageSlugTakenError)

    const failing = tableClient({}, { error: { code: '42501' } })

    await expect(
      new SupabaseStatusPageSettings(failing.client).save('t1', input),
    ).rejects.toThrow('status page save failed')
  })
})

describe('SupabasePublicStatusPage', () => {
  const PAGE = {
    description: null,
    generatedAt: '2026-10-31T12:00:00Z',
    incidents: [],
    monitors: [{ name: 'API', status: 'healthy', uptime30d: 100 }],
    title: 'Acme',
  }

  it('returns the validated read model, or null when absent', async () => {
    const read = (data: unknown) =>
      new SupabasePublicStatusPage({
        rpc: async () => ({ data, error: null }),
      } as unknown as SupabaseClient).read('acme')

    await expect(read(PAGE)).resolves.toEqual(PAGE)
    await expect(read(null)).resolves.toBeNull()
    await expect(read({ title: 1 })).rejects.toThrow('malformed')
  })

  it('fails closed on provider errors', async () => {
    const reader = new SupabasePublicStatusPage({
      rpc: async () => ({ data: null, error: { code: 'x' } }),
    } as unknown as SupabaseClient)

    await expect(reader.read('acme')).rejects.toThrow(
      'public status page query failed',
    )
  })
})
