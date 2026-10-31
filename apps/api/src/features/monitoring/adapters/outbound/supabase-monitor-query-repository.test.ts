import { describe, expect, it, vi } from 'vitest'

import {
  SupabaseMonitorQueryRepository,
  type MonitorQueryClient,
} from './supabase-monitor-query-repository.ts'

const ROW = {
  alert_at: '2026-10-24T12:05:30.000Z',
  alerts_enabled: true,
  created_at: '2026-10-24T12:00:00.000Z',
  cron_expression: null,
  cron_timezone: null,
  tags: ['prod'],
  description: null,
  folder_id: null,
  grace_seconds: 30,
  id: '20000000-0000-4000-8000-000000000001',
  incident_opened_at: null,
  interval_seconds: 300,
  last_heartbeat_at: null,
  name: null,
  notes: null,
  paused_at: null,
  running_since: null,
  status: 'pending',
  tenant_id: '10000000-0000-4000-8000-000000000001',
  total_pings: 0,
}

describe('SupabaseMonitorQueryRepository', () => {
  it('lists only minimal state with an explicit tenant filter', async () => {
    const order = vi.fn(async () => ({ data: [ROW], error: null }))
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select }))
    const repository = new SupabaseMonitorQueryRepository({
      from,
    } as unknown as MonitorQueryClient)

    await expect(repository.findAllByTenant(ROW.tenant_id)).resolves.toEqual([
      {
        alertAtMs: Date.parse(ROW.alert_at),
        alertsEnabled: true,
        createdAtMs: Date.parse(ROW.created_at),
        cronExpression: null,
        cronTimezone: null,
        tags: ['prod'],
        description: null,
        folderId: null,
        graceSeconds: 30,
        id: ROW.id,
        incidentOpenedAtMs: null,
        intervalSeconds: 300,
        lastHeartbeatAtMs: null,
        name: null,
        notes: null,
        pausedAtMs: null,
        runningSinceMs: null,
        status: 'pending',
        tenantId: ROW.tenant_id,
        totalPings: 0,
      },
    ])

    expect(from).toHaveBeenCalledWith('monitors')
    expect(select).toHaveBeenCalledWith(
      'id, tenant_id, interval_seconds, grace_seconds, status, last_heartbeat_at, alert_at, incident_opened_at, paused_at, created_at, folder_id, total_pings, name, description, notes, alerts_enabled, running_since, cron_expression, cron_timezone, tags',
    )
    expect(eq).toHaveBeenCalledWith('tenant_id', ROW.tenant_id)
  })

  it('retrieves detail by tenant and monitor id', async () => {
    const maybeSingle = vi.fn(async () => ({ data: ROW, error: null }))
    const secondEq = vi.fn(() => ({ maybeSingle }))
    const firstEq = vi.fn(() => ({ eq: secondEq }))
    const select = vi.fn(() => ({ eq: firstEq }))
    const from = vi.fn(() => ({ select }))
    const repository = new SupabaseMonitorQueryRepository({
      from,
    } as unknown as MonitorQueryClient)

    await expect(
      repository.findById(ROW.tenant_id, ROW.id),
    ).resolves.toMatchObject({ id: ROW.id, tenantId: ROW.tenant_id })
    expect(firstEq).toHaveBeenCalledWith('tenant_id', ROW.tenant_id)
    expect(secondEq).toHaveBeenCalledWith('id', ROW.id)
  })

  it('translates list and detail failures without leaking provider details', async () => {
    const listRepository = new SupabaseMonitorQueryRepository({
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
    } as unknown as MonitorQueryClient)
    await expect(listRepository.findAllByTenant(ROW.tenant_id)).rejects.toThrow(
      'monitor query failed',
    )

    const detailRepository = new SupabaseMonitorQueryRepository({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: null,
                error: { message: 'database unavailable' },
              }),
            }),
          }),
        }),
      }),
    } as unknown as MonitorQueryClient)
    await expect(
      detailRepository.findById(ROW.tenant_id, ROW.id),
    ).rejects.toThrow('monitor query failed')
  })
})
