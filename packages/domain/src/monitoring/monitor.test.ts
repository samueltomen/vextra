import { describe, expect, it } from 'vitest'

import {
  createMonitor,
  detectOverdue,
  pauseMonitor,
  registerHeartbeat,
  resumeMonitor,
} from './monitor.ts'

const CREATED_AT_MS = Date.parse('2026-01-01T00:00:00.000Z')

function createMinuteMonitor() {
  return createMonitor({
    id: 'monitor-1',
    tenantId: 'tenant-1',
    intervalSeconds: 60,
    graceSeconds: 15,
    nowMs: CREATED_AT_MS,
  })
}

describe('monitor scheduling', () => {
  it('creates a pending monitor with an interval and grace deadline', () => {
    const monitor = createMinuteMonitor()

    expect(monitor).toMatchObject({
      id: 'monitor-1',
      tenantId: 'tenant-1',
      status: 'pending',
      lastHeartbeatAtMs: null,
      incidentOpenedAtMs: null,
      pausedAtMs: null,
    })
    expect(monitor.alertAtMs).toBe(CREATED_AT_MS + 75_000)
  })

  it('rejects an invalid monitoring configuration', () => {
    expect(() =>
      createMonitor({
        id: 'monitor-1',
        tenantId: 'tenant-1',
        intervalSeconds: 59,
        graceSeconds: 15,
        nowMs: CREATED_AT_MS,
      }),
    ).toThrow(RangeError)

    expect(() =>
      createMonitor({
        id: 'monitor-1',
        tenantId: 'tenant-1',
        intervalSeconds: 60,
        graceSeconds: -1,
        nowMs: CREATED_AT_MS,
      }),
    ).toThrow(RangeError)
  })

  it('stays pending before the deadline', () => {
    const monitor = createMinuteMonitor()
    const unchanged = detectOverdue(monitor, monitor.alertAtMs - 1)

    expect(unchanged).toBe(monitor)
  })

  it('opens one incident exactly at the deadline', () => {
    const monitor = createMinuteMonitor()
    const late = detectOverdue(monitor, monitor.alertAtMs)

    expect(late.status).toBe('late')
    expect(late.incidentOpenedAtMs).toBe(monitor.alertAtMs)

    const duplicateCheck = detectOverdue(late, monitor.alertAtMs + 60_000)
    expect(duplicateCheck).toBe(late)
  })

  it('resolves an incident and schedules the next deadline on heartbeat', () => {
    const late = detectOverdue(createMinuteMonitor(), CREATED_AT_MS + 75_000)
    const heartbeatAtMs = CREATED_AT_MS + 90_000
    const healthy = registerHeartbeat(late, heartbeatAtMs)

    expect(healthy.status).toBe('healthy')
    expect(healthy.lastHeartbeatAtMs).toBe(heartbeatAtMs)
    expect(healthy.incidentOpenedAtMs).toBeNull()
    expect(healthy.alertAtMs).toBe(heartbeatAtMs + 75_000)
  })

  it('ignores an out-of-order heartbeat', () => {
    const heartbeatAtMs = CREATED_AT_MS + 30_000
    const healthy = registerHeartbeat(createMinuteMonitor(), heartbeatAtMs)
    const unchanged = registerHeartbeat(healthy, heartbeatAtMs - 1)

    expect(unchanged).toBe(healthy)
  })

  it('pauses monitoring and closes an open incident', () => {
    const late = detectOverdue(createMinuteMonitor(), CREATED_AT_MS + 75_000)
    const pausedAtMs = CREATED_AT_MS + 80_000
    const paused = pauseMonitor(late, pausedAtMs)

    expect(paused.status).toBe('paused')
    expect(paused.pausedAtMs).toBe(pausedAtMs)
    expect(paused.incidentOpenedAtMs).toBeNull()
    expect(detectOverdue(paused, pausedAtMs + 60_000)).toBe(paused)
  })

  it('ignores heartbeats while paused', () => {
    const paused = pauseMonitor(createMinuteMonitor(), CREATED_AT_MS + 10_000)
    const unchanged = registerHeartbeat(paused, CREATED_AT_MS + 20_000)

    expect(unchanged).toBe(paused)
  })

  it('resumes with a fresh deadline and preserves the last heartbeat', () => {
    const heartbeatAtMs = CREATED_AT_MS + 30_000
    const healthy = registerHeartbeat(createMinuteMonitor(), heartbeatAtMs)
    const paused = pauseMonitor(healthy, CREATED_AT_MS + 40_000)
    const resumedAtMs = CREATED_AT_MS + 50_000
    const resumed = resumeMonitor(paused, resumedAtMs)

    expect(resumed.status).toBe('healthy')
    expect(resumed.lastHeartbeatAtMs).toBe(heartbeatAtMs)
    expect(resumed.pausedAtMs).toBeNull()
    expect(resumed.alertAtMs).toBe(resumedAtMs + 75_000)
  })

  it('returns a pending monitor after resume when it never received a heartbeat', () => {
    const paused = pauseMonitor(createMinuteMonitor(), CREATED_AT_MS + 10_000)
    const resumed = resumeMonitor(paused, CREATED_AT_MS + 20_000)

    expect(resumed.status).toBe('pending')
    expect(resumed.alertAtMs).toBe(CREATED_AT_MS + 95_000)
  })

  it('rejects invalid timestamps', () => {
    expect(() => detectOverdue(createMinuteMonitor(), Number.NaN)).toThrow(
      TypeError,
    )
  })
})
