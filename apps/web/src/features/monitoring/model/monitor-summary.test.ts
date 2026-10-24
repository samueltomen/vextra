import { describe, expect, it } from 'vitest'

import { summarizeMonitors, type MonitorView } from './monitor.ts'

function monitor(status: MonitorView['status']): MonitorView {
  return {
    id: status,
    tenantId: 'tenant-demo',
    localLabel: status,
    intervalMinutes: 5,
    graceMinutes: 2,
    status,
    lastHeartbeatAtMs: null,
    alertAtMs: 0,
    channel: 'email',
  }
}

describe('summarizeMonitors', () => {
  it('counts each operational state', () => {
    const summary = summarizeMonitors([
      monitor('healthy'),
      monitor('healthy'),
      monitor('late'),
      monitor('paused'),
      monitor('pending'),
    ])

    expect(summary).toEqual({
      healthy: 2,
      late: 1,
      paused: 1,
      pending: 1,
      total: 5,
    })
  })

  it('returns zeroes for an empty dashboard', () => {
    expect(summarizeMonitors([])).toEqual({
      healthy: 0,
      late: 0,
      paused: 0,
      pending: 0,
      total: 0,
    })
  })
})
