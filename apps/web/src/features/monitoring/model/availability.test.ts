import { describe, expect, it } from 'vitest'

import {
  computeAvailability,
  formatDuration,
  formatUptime,
} from './availability.ts'

const DAY_MS = 86_400_000
const NOW_MS = Date.UTC(2026, 9, 24, 12, 0, 0)

describe('computeAvailability', () => {
  it('reports full uptime when a monitor never had an incident', () => {
    const result = computeAvailability({
      createdAtMs: NOW_MS - 10 * DAY_MS,
      incidents: [],
      nowMs: NOW_MS,
    })

    expect(result.uptimePercent).toBe(100)
    expect(result.incidentCount).toBe(0)
    expect(result.mttrMs).toBeNull()
    expect(result.days).toHaveLength(30)
    expect(result.days.filter((day) => day.state === 'none')).toHaveLength(20)
    expect(result.days.at(-1)?.state).toBe('up')
  })

  it('subtracts resolved incident time and computes the mean time to recovery', () => {
    const result = computeAvailability({
      createdAtMs: NOW_MS - 10 * DAY_MS,
      incidents: [
        {
          openedAtMs: NOW_MS - 2 * DAY_MS,
          resolvedAtMs: NOW_MS - 2 * DAY_MS + 60 * 60_000,
        },
        {
          openedAtMs: NOW_MS - 5 * DAY_MS,
          resolvedAtMs: NOW_MS - 5 * DAY_MS + 3 * 60 * 60_000,
        },
      ],
      nowMs: NOW_MS,
    })

    expect(result.incidentCount).toBe(2)
    expect(result.mttrMs).toBe(2 * 60 * 60_000)
    expect(result.uptimePercent).toBeCloseTo((1 - 4 / 240) * 100, 5)
  })

  it('counts an open incident until now and marks the day as degraded', () => {
    const result = computeAvailability({
      createdAtMs: NOW_MS - 3 * DAY_MS,
      incidents: [{ openedAtMs: NOW_MS - 60 * 60_000, resolvedAtMs: null }],
      nowMs: NOW_MS,
    })

    expect(result.incidentCount).toBe(1)
    expect(result.mttrMs).toBeNull()
    expect(result.uptimePercent).toBeLessThan(100)
    expect(result.days.at(-1)?.state).toBe('degraded')
  })

  it('marks a day as down when at least a quarter of it was lost', () => {
    const result = computeAvailability({
      createdAtMs: NOW_MS - 3 * DAY_MS,
      incidents: [
        {
          openedAtMs: NOW_MS - 12 * 60 * 60_000,
          resolvedAtMs: NOW_MS - 2 * 60 * 60_000,
        },
      ],
      nowMs: NOW_MS,
    })

    expect(result.days.at(-1)?.state).toBe('down')
  })

  it('does not report a percentage before a minute of observation', () => {
    const result = computeAvailability({
      createdAtMs: NOW_MS - 10_000,
      incidents: [],
      nowMs: NOW_MS,
    })

    expect(result.uptimePercent).toBeNull()
  })
})

describe('availability formatting', () => {
  it('formats durations with the most readable unit', () => {
    expect(formatDuration(30_000)).toBe('1 min')
    expect(formatDuration(25 * 60_000)).toBe('25 min')
    expect(formatDuration(90 * 60_000)).toBe('1 h 30 min')
    expect(formatDuration(26 * 60 * 60_000)).toBe('1 j 2 h')
  })

  it('never rounds a degraded uptime up to 100 percent', () => {
    expect(formatUptime(null)).toBe('—')
    expect(formatUptime(100)).toBe('100 %')
    expect(formatUptime(99.999)).toBe('100 %')
    expect(formatUptime(99.989)).toBe('99,98 %')
  })
})
