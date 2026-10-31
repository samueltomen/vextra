import { describe, expect, it } from 'vitest'

import type { MonitorView } from './monitor.ts'
import {
  getDueProgress,
  sortMonitors,
  withEffectiveStatus,
} from './monitor-timing.ts'

const NOW_MS = 1_000_000_000

function monitor(overrides: Partial<MonitorView>): MonitorView {
  return {
    alertAtMs: NOW_MS + 600_000,
    alertsEnabled: true,
    createdAtMs: NOW_MS - 600_000,
    description: null,
    folderId: null,
    graceMinutes: 5,
    id: 'monitor',
    incidentOpenedAtMs: null,
    intervalMinutes: 15,
    lastHeartbeatAtMs: NOW_MS - 600_000,
    localLabel: 'Monitor',
    notes: null,
    serverName: null,
    status: 'healthy',
    totalPings: 0,
    ...overrides,
  }
}

describe('getDueProgress', () => {
  it('measures the time elapsed between the last signal and the alert', () => {
    expect(getDueProgress(monitor({}), NOW_MS)).toEqual({
      fraction: 0.5,
      overdue: false,
    })
  })

  it('uses the creation date until a first signal is received', () => {
    const progress = getDueProgress(
      monitor({ lastHeartbeatAtMs: null, status: 'pending' }),
      NOW_MS,
    )

    expect(progress?.fraction).toBe(0.5)
  })

  it('flags a monitor whose deadline has passed', () => {
    expect(getDueProgress(monitor({ alertAtMs: NOW_MS - 1 }), NOW_MS)).toEqual({
      fraction: 1,
      overdue: true,
    })
  })

  it('has no deadline progress for a paused monitor', () => {
    expect(getDueProgress(monitor({ status: 'paused' }), NOW_MS)).toBeNull()
  })
})

describe('sortMonitors', () => {
  const late = monitor({ id: 'late', localLabel: 'Zeta', status: 'late' })
  const healthy = monitor({ id: 'healthy', localLabel: 'alpha' })
  const paused = monitor({ id: 'paused', localLabel: 'Beta', status: 'paused' })
  const fresh = monitor({
    createdAtMs: NOW_MS,
    id: 'fresh',
    lastHeartbeatAtMs: null,
    localLabel: 'Gamma',
    status: 'pending',
  })
  const all = [paused, healthy, fresh, late]

  it('puts monitors that need attention first by default', () => {
    expect(sortMonitors(all, 'priority').map((item) => item.id)).toEqual([
      'late',
      'fresh',
      'healthy',
      'paused',
    ])
  })

  it('sorts by label ignoring case', () => {
    expect(sortMonitors(all, 'name').map((item) => item.id)).toEqual([
      'healthy',
      'paused',
      'fresh',
      'late',
    ])
  })

  it('sorts by creation date, newest first', () => {
    expect(sortMonitors(all, 'recent')[0]?.id).toBe('fresh')
  })

  it('sorts by last signal and keeps never-seen monitors last', () => {
    expect(sortMonitors(all, 'signal').at(-1)?.id).toBe('fresh')
  })

  it('does not mutate the input list', () => {
    const input = [paused, late]
    sortMonitors(input, 'priority')
    expect(input.map((item) => item.id)).toEqual(['paused', 'late'])
  })
})

describe('withEffectiveStatus', () => {
  it('shows an overdue active monitor as late without waiting for the server', () => {
    const overdue = monitor({ alertAtMs: NOW_MS - 60_000, status: 'healthy' })

    expect(withEffectiveStatus(overdue, NOW_MS).status).toBe('late')
    expect(
      withEffectiveStatus({ ...overdue, status: 'pending' }, NOW_MS).status,
    ).toBe('late')
  })

  it('keeps paused, late and on-time monitors unchanged', () => {
    const paused = monitor({ alertAtMs: NOW_MS - 60_000, status: 'paused' })
    const onTime = monitor({ alertAtMs: NOW_MS + 60_000, status: 'healthy' })

    expect(withEffectiveStatus(paused, NOW_MS)).toBe(paused)
    expect(withEffectiveStatus(onTime, NOW_MS)).toBe(onTime)
  })
})
