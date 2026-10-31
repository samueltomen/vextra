import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { MonitorMetricsService } from '../../application/monitor-metrics.ts'
import { SupabaseMonitorMetrics } from './supabase-monitor-metrics.ts'

function client(
  monitor: { data: unknown; error?: object | null },
  stats: { data?: unknown; error?: object | null } = { data: [] },
) {
  const filters: Array<[string, unknown[]]> = []
  const builder = (result: { data?: unknown; error?: object | null }) => {
    const resolved = { data: result.data ?? null, error: result.error ?? null }
    const chain: Record<string, unknown> = {}

    for (const method of ['select', 'eq', 'gte', 'order']) {
      chain[method] = vi.fn((...args: unknown[]) => {
        filters.push([method, args])

        return chain
      })
    }

    chain['maybeSingle'] = vi.fn(async () => resolved)
    chain['then'] = (resolve: (value: typeof resolved) => unknown) =>
      Promise.resolve(resolved).then(resolve)

    return chain
  }

  return {
    filters,
    supabase: {
      from: (table: string) => builder(table === 'monitors' ? monitor : stats),
    } as unknown as SupabaseClient,
  }
}

describe('SupabaseMonitorMetrics', () => {
  it('returns the counters of a monitor scoped to its tenant', async () => {
    const { filters, supabase } = client(
      { data: { total_pings: '12' } },
      {
        data: [
          {
            day: '2026-10-31',
            gap_count: 2,
            gap_max_seconds: 90,
            gap_sum_seconds: '150',
            pings: 3,
          },
        ],
      },
    )

    await expect(
      new SupabaseMonitorMetrics(supabase).find('tenant-a', 'm1', '2026-10-02'),
    ).resolves.toEqual({
      days: [
        {
          day: '2026-10-31',
          gapCount: 2,
          gapMaxSeconds: 90,
          gapSumSeconds: 150,
          pings: 3,
        },
      ],
      totalPings: 12,
    })
    expect(filters).toContainEqual(['eq', ['tenant_id', 'tenant-a']])
    expect(filters).toContainEqual(['gte', ['day', '2026-10-02']])
  })

  it('returns null for an unknown monitor and fails closed on errors', async () => {
    await expect(
      new SupabaseMonitorMetrics(client({ data: null }).supabase).find(
        't',
        'm',
        '2026-10-02',
      ),
    ).resolves.toBeNull()
    await expect(
      new SupabaseMonitorMetrics(
        client({ data: null, error: { code: 'x' } }).supabase,
      ).find('t', 'm', '2026-10-02'),
    ).rejects.toThrow('metrics query failed')
    await expect(
      new SupabaseMonitorMetrics(
        client({ data: { total_pings: 1 } }, { error: { code: 'x' } }).supabase,
      ).find('t', 'm', '2026-10-02'),
    ).rejects.toThrow('metrics query failed')
  })
})

describe('SupabaseMonitorMetrics activity', () => {
  it('reads daily pings of every monitor of the tenant', async () => {
    const { filters, supabase } = client(
      { data: null },
      { data: [{ day: '2026-10-31', monitor_id: 'm1', pings: '4' }] },
    )

    await expect(
      new SupabaseMonitorMetrics(supabase).activity('tenant-a', '2026-10-18'),
    ).resolves.toEqual([{ day: '2026-10-31', monitorId: 'm1', pings: 4 }])
    expect(filters).toContainEqual(['eq', ['tenant_id', 'tenant-a']])
    expect(filters).toContainEqual(['gte', ['day', '2026-10-18']])
    await expect(
      new SupabaseMonitorMetrics(
        client({ data: null }, { error: { code: 'x' } }).supabase,
      ).activity('t', '2026-10-18'),
    ).rejects.toThrow('activity query failed')
  })
})

describe('MonitorMetricsService', () => {
  it('asks for the last 14 UTC days of activity', async () => {
    const activity = vi.fn(async () => [])
    const service = new MonitorMetricsService({
      nowMs: () => Date.parse('2026-10-31T12:00:00.000Z'),
      port: { activity, find: vi.fn(async () => null) },
    })

    await service.activity('t')

    expect(activity).toHaveBeenCalledWith('t', '2026-10-18')
  })

  it('asks for the last 30 UTC days including today', async () => {
    const find = vi.fn(async () => null)
    const service = new MonitorMetricsService({
      nowMs: () => Date.parse('2026-10-31T12:00:00.000Z'),
      port: { activity: vi.fn(async () => []), find },
    })

    await service.get('t', 'm')

    expect(find).toHaveBeenCalledWith('t', 'm', '2026-10-02')
  })
})
