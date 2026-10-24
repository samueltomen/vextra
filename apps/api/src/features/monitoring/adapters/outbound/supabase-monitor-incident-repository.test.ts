import { describe, expect, it, vi } from 'vitest'

import {
  SupabaseMonitorIncidentRepository,
  type MonitorIncidentQueryClient,
} from './supabase-monitor-incident-repository.ts'

describe('SupabaseMonitorIncidentRepository', () => {
  it('lists incident lifecycle only for the requested monitor', async () => {
    const order = vi.fn(async () => ({
      data: [
        {
          id: 'incident-1',
          monitor_id: '20000000-0000-4000-8000-000000000001',
          opened_at: '2026-10-24T12:00:00.000Z',
          reason: 'heartbeat_missed',
          resolution_reason: null,
          resolved_at: null,
        },
      ],
      error: null,
    }))
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))
    const repository = new SupabaseMonitorIncidentRepository({
      from: () => ({ select }),
    } as unknown as MonitorIncidentQueryClient)

    await expect(
      repository.listByMonitor('20000000-0000-4000-8000-000000000001'),
    ).resolves.toEqual([
      {
        id: 'incident-1',
        monitorId: '20000000-0000-4000-8000-000000000001',
        openedAtMs: Date.parse('2026-10-24T12:00:00.000Z'),
        reason: 'heartbeat_missed',
        resolutionReason: null,
        resolvedAtMs: null,
      },
    ])
    expect(eq).toHaveBeenCalledWith(
      'monitor_id',
      '20000000-0000-4000-8000-000000000001',
    )
  })

  it('rejects query failures without leaking provider details', async () => {
    const repository = new SupabaseMonitorIncidentRepository({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: null,
              error: { message: 'database unavailable' },
            }),
          }),
        }),
      }),
    } as unknown as MonitorIncidentQueryClient)

    await expect(
      repository.listByMonitor('20000000-0000-4000-8000-000000000001'),
    ).rejects.toThrow('incident query failed')
  })
})
