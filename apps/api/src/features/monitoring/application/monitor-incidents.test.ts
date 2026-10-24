import { describe, expect, it, vi } from 'vitest'

import {
  MonitorIncidents,
  type MonitorIncidentRecord,
  type MonitorIncidentPort,
} from './monitor-incidents.ts'

const INCIDENT: MonitorIncidentRecord = {
  id: '60000000-0000-4000-8000-000000000001',
  monitorId: '20000000-0000-4000-8000-000000000001',
  openedAtMs: Date.parse('2026-10-24T12:00:00.000Z'),
  reason: 'heartbeat_missed',
  resolutionReason: null,
  resolvedAtMs: null,
}

describe('MonitorIncidents', () => {
  it('lists incidents only for the requested monitor', async () => {
    const port: MonitorIncidentPort = {
      listByMonitor: vi.fn(async () => [INCIDENT]),
    }
    const service = new MonitorIncidents(port)

    await expect(service.list(INCIDENT.monitorId)).resolves.toEqual([INCIDENT])
    expect(port.listByMonitor).toHaveBeenCalledWith(INCIDENT.monitorId)
  })
})
