import { describe, expect, it, vi } from 'vitest'

import type { NewMonitorRecord } from '../../application/create-monitor.ts'
import { SupabaseMonitorRepository } from './supabase-monitor-repository.ts'

const RECORD: NewMonitorRecord = {
  monitor: {
    id: 'monitor-1',
    tenantId: 'tenant-a',
    intervalSeconds: 300,
    graceSeconds: 30,
    status: 'pending',
    lastHeartbeatAtMs: null,
    alertAtMs: Date.parse('2026-01-01T00:05:30.000Z'),
    incidentOpenedAtMs: null,
    pausedAtMs: null,
  },
  heartbeatTokenHash: 'hashed-token',
  heartbeatTokenPrefix: 'token-pr',
}

describe('SupabaseMonitorRepository', () => {
  it('inserts only the tenant-scoped monitor state and token hash', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const repository = new SupabaseMonitorRepository({
      from: vi.fn(() => ({ insert })),
    })

    await repository.save(RECORD)

    expect(insert).toHaveBeenCalledWith({
      id: 'monitor-1',
      tenant_id: 'tenant-a',
      heartbeat_token_hash: 'hashed-token',
      heartbeat_token_prefix: 'token-pr',
      interval_seconds: 300,
      grace_seconds: 30,
      status: 'pending',
      last_heartbeat_at: null,
      alert_at: '2026-01-01T00:05:30.000Z',
      incident_opened_at: null,
      paused_at: null,
      enabled: true,
    })
    expect(JSON.stringify(insert.mock.calls)).not.toContain('raw-secret-token')
  })

  it('translates persistence failures without leaking provider details', async () => {
    const repository = new SupabaseMonitorRepository({
      from: () => ({
        insert: async () => ({
          error: { message: 'duplicate key value violates unique constraint' },
        }),
      }),
    })

    await expect(repository.save(RECORD)).rejects.toThrow(
      'monitor persistence failed',
    )
  })

  it('serializes non-null state timestamps as ISO strings', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const repository = new SupabaseMonitorRepository({
      from: () => ({ insert }),
    })

    await repository.save({
      ...RECORD,
      monitor: {
        ...RECORD.monitor,
        incidentOpenedAtMs: Date.parse('2026-01-01T00:06:00.000Z'),
        lastHeartbeatAtMs: Date.parse('2026-01-01T00:05:00.000Z'),
        pausedAtMs: Date.parse('2026-01-01T00:07:00.000Z'),
      },
    })

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        incident_opened_at: '2026-01-01T00:06:00.000Z',
        last_heartbeat_at: '2026-01-01T00:05:00.000Z',
        paused_at: '2026-01-01T00:07:00.000Z',
      }),
    )
  })
})
