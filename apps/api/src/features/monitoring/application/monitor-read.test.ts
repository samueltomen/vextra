import { describe, expect, it, vi } from 'vitest'

import {
  MonitorReadService,
  type MonitorQueryPort,
  type MonitorStateRecord,
} from './monitor-read.ts'

const MONITOR: MonitorStateRecord = {
  alertAtMs: Date.parse('2026-10-24T12:05:30.000Z'),
  alertsEnabled: true,
  createdAtMs: Date.parse('2026-10-24T12:00:00.000Z'),
  cronExpression: null,
  cronTimezone: null,
  tags: ['prod'],
  description: null,
  folderId: null,
  graceSeconds: 30,
  id: '20000000-0000-4000-8000-000000000001',
  incidentOpenedAtMs: null,
  intervalSeconds: 300,
  lastHeartbeatAtMs: null,
  name: null,
  notes: null,
  pausedAtMs: null,
  runningSinceMs: null,
  status: 'pending',
  tenantId: '10000000-0000-4000-8000-000000000001',
  totalPings: 0,
}

function createPort(
  overrides: Partial<MonitorQueryPort> = {},
): MonitorQueryPort {
  return {
    findAllByTenant: vi.fn(async () => [MONITOR]),
    findById: vi.fn(async () => MONITOR),
    ...overrides,
  }
}

describe('MonitorReadService', () => {
  it('lists monitors only through an explicit tenant boundary', async () => {
    const port = createPort()
    const service = new MonitorReadService(port)

    await expect(service.list(MONITOR.tenantId)).resolves.toEqual([MONITOR])
    expect(port.findAllByTenant).toHaveBeenCalledWith(MONITOR.tenantId)
  })

  it('retrieves a monitor with both tenant and id constraints', async () => {
    const port = createPort()
    const service = new MonitorReadService(port)

    await expect(service.get(MONITOR.tenantId, MONITOR.id)).resolves.toEqual(
      MONITOR,
    )
    expect(port.findById).toHaveBeenCalledWith(MONITOR.tenantId, MONITOR.id)
  })

  it('returns null when a monitor is absent from the tenant', async () => {
    const service = new MonitorReadService(
      createPort({ findById: vi.fn(async () => null) }),
    )

    await expect(service.get(MONITOR.tenantId, MONITOR.id)).resolves.toBeNull()
  })
})
