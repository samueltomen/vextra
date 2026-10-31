import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  MaintenanceLimitError,
  MaintenanceMonitorNotFoundError,
} from '../../application/maintenance.ts'
import { SupabaseMaintenance } from './supabase-maintenance.ts'

const ROW = {
  ends_at: '2026-11-02T04:00:00+00:00',
  id: 'w1',
  monitor_id: null,
  name: 'Migration',
  starts_at: '2026-11-02T02:00:00+00:00',
}
const INPUT = {
  endsAt: '2026-11-02T04:00:00.000Z',
  monitorId: null,
  name: 'Migration',
  startsAt: '2026-11-02T02:00:00.000Z',
}

function client(result: object) {
  const calls: [string, unknown[]][] = []
  const builder: Record<string, unknown> = {}

  for (const method of [
    'select',
    'eq',
    'gt',
    'order',
    'insert',
    'delete',
  ] as const) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args])

      return builder
    }
  }
  builder.single = async () => result
  builder.then = (resolve: (value: unknown) => void) => resolve(result)

  return {
    calls,
    supabase: { from: vi.fn(() => builder) } as unknown as SupabaseClient,
  }
}

describe('SupabaseMaintenance', () => {
  it('lists upcoming windows of the tenant', async () => {
    const { calls, supabase } = client({ data: [ROW], error: null })

    await expect(new SupabaseMaintenance(supabase).list('t1')).resolves.toEqual(
      [
        {
          endsAt: '2026-11-02T04:00:00.000Z',
          id: 'w1',
          monitorId: null,
          name: 'Migration',
          startsAt: '2026-11-02T02:00:00.000Z',
        },
      ],
    )
    expect(calls).toContainEqual(['eq', ['tenant_id', 't1']])
  })

  it('creates a window scoped to the tenant', async () => {
    const { calls, supabase } = client({ data: ROW, error: null })

    await new SupabaseMaintenance(supabase).create('t1', INPUT)
    expect(calls).toContainEqual([
      'insert',
      [
        {
          ends_at: INPUT.endsAt,
          monitor_id: null,
          name: 'Migration',
          starts_at: INPUT.startsAt,
          tenant_id: 't1',
        },
      ],
    ])
  })

  it('maps the limit and unknown monitor errors, hides the rest', async () => {
    const create = (code: string) =>
      new SupabaseMaintenance(
        client({ data: null, error: { code } }).supabase,
      ).create('t1', INPUT)

    await expect(create('54000')).rejects.toBeInstanceOf(MaintenanceLimitError)
    await expect(create('23503')).rejects.toBeInstanceOf(
      MaintenanceMonitorNotFoundError,
    )
    await expect(create('42501')).rejects.toThrow('maintenance creation failed')
  })

  it('removes a window and reports whether it existed', async () => {
    const removed = new SupabaseMaintenance(
      client({ data: [{ id: 'w1' }], error: null }).supabase,
    )
    const absent = new SupabaseMaintenance(
      client({ data: [], error: null }).supabase,
    )

    await expect(removed.remove('t1', 'w1')).resolves.toBe(true)
    await expect(absent.remove('t1', 'w1')).resolves.toBe(false)
  })

  it('fails closed on list and delete errors', async () => {
    const failing = new SupabaseMaintenance(
      client({ data: null, error: { code: 'x' } }).supabase,
    )

    await expect(failing.list('t1')).rejects.toThrow('maintenance query failed')
    await expect(failing.remove('t1', 'w1')).rejects.toThrow(
      'maintenance deletion failed',
    )
  })
})
