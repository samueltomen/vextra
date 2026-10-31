import { describe, expect, it } from 'vitest'

import {
  denseActivity,
  formatMilliseconds,
  formatSeconds,
  summarizeMetrics,
} from './metrics-summary.ts'

const NOW = Date.parse('2026-10-31T12:00:00.000Z')

describe('summarizeMetrics', () => {
  it('builds 30 dense daily bars ending today', () => {
    const summary = summarizeMetrics([], 3_600, NOW)

    expect(summary.bars).toHaveLength(30)
    expect(summary.bars.at(-1)?.day).toBe('2026-10-31')
    expect(summary.bars[0]?.day).toBe('2026-10-02')
    expect(summary.pings30d).toBe(0)
    expect(summary.avgIntervalSeconds).toBeNull()
    expect(summary.maxGapSeconds).toBeNull()
    expect(summary.regularity).toBeNull()
    expect(summary.avgDurationMs).toBeNull()
    expect(summary.maxDurationMs).toBeNull()
    expect(summary.fails30d).toBe(0)
  })

  it('aggregates pings, gaps and regularity', () => {
    const summary = summarizeMetrics(
      [
        {
          day: '2026-10-30',
          durationCount: 2,
          durationMaxMs: 2_000,
          durationSumMs: 3_000,
          fails: 1,
          gapCount: 2,
          gapMaxSeconds: 4_000,
          gapSumSeconds: 7_000,
          pings: 3,
        },
        {
          day: '2026-10-31',
          durationCount: 2,
          durationMaxMs: 4_000,
          durationSumMs: 5_000,
          fails: 2,
          gapCount: 2,
          gapMaxSeconds: 3_800,
          gapSumSeconds: 7_400,
          pings: 3,
        },
        {
          day: '2026-08-01',
          durationCount: 9,
          durationMaxMs: 99_999,
          durationSumMs: 99_999,
          fails: 9,
          gapCount: 9,
          gapMaxSeconds: 99_999,
          gapSumSeconds: 99_999,
          pings: 9,
        },
      ],
      3_600,
      NOW,
    )

    expect(summary.pings30d).toBe(6)
    expect(summary.pingsToday).toBe(3)
    expect(summary.peakPings).toBe(3)
    expect(summary.avgIntervalSeconds).toBe(3_600)
    expect(summary.maxGapSeconds).toBe(4_000)
    expect(summary.regularity).toBe(1)
    expect(summary.dailyAvgIntervalSeconds.at(-1)).toBe(3_700)
    expect(summary.dailyAvgIntervalSeconds.at(-2)).toBe(3_500)
    expect(summary.dailyAvgIntervalSeconds[0]).toBeNull()
    expect(summary.fails30d).toBe(3)
    expect(summary.avgDurationMs).toBe(2_000)
    expect(summary.maxDurationMs).toBe(4_000)
    expect(summary.dailyAvgDurationMs.at(-1)).toBe(2_500)
    expect(summary.dailyAvgDurationMs[0]).toBeNull()
  })
})

describe('formatSeconds', () => {
  it('formats durations compactly', () => {
    expect(formatSeconds(null)).toBe('—')
    expect(formatSeconds(45)).toBe('45 s')
    expect(formatSeconds(600)).toBe('10 min')
    expect(formatSeconds(7_200)).toBe('2,0 h')
    expect(formatSeconds(3 * 86_400)).toBe('3 j')
  })
})

describe('denseActivity', () => {
  it('fills missing days with zero, oldest first', () => {
    const activity = denseActivity(
      [
        { day: '2026-10-31', pings: 4 },
        { day: '2026-10-29', pings: 2 },
        { day: '2026-01-01', pings: 9 },
      ],
      NOW,
    )

    expect(activity).toHaveLength(14)
    expect(activity.at(-1)).toBe(4)
    expect(activity.at(-2)).toBe(0)
    expect(activity.at(-3)).toBe(2)
    expect(activity.reduce((sum, value) => sum + value, 0)).toBe(6)
  })
})

describe('formatMilliseconds', () => {
  it('formats run durations compactly', () => {
    expect(formatMilliseconds(null)).toBe('—')
    expect(formatMilliseconds(420)).toBe('420 ms')
    expect(formatMilliseconds(2_500)).toBe('2,5 s')
    expect(formatMilliseconds(45_000)).toBe('45 s')
    expect(formatMilliseconds(600_000)).toBe('10 min')
  })
})
