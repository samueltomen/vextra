import { describe, expect, it } from 'vitest'

import { summarizeMonitors, type MonitorView } from './monitor.ts'

function monitor(status: MonitorView['status']): MonitorView {
  return {
    alertAtMs: 0,
    alertsEnabled: true,
    createdAtMs: 0,
    cronExpression: null,
    cronTimezone: null,
    description: null,
    folderId: null,
    graceMinutes: 2,
    id: status,
    incidentOpenedAtMs: null,
    intervalMinutes: 5,
    localLabel: status,
    lastHeartbeatAtMs: null,
    notes: null,
    runningSinceMs: null,
    serverName: null,
    status,
    totalPings: 0,
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
