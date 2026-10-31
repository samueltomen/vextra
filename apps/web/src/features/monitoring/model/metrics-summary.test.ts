import { describe, expect, it } from 'vitest'

import { formatSeconds, summarizeMetrics } from './metrics-summary.ts'

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
  })

  it('aggregates pings, gaps and regularity', () => {
    const summary = summarizeMetrics(
      [
        {
          day: '2026-10-30',
          gapCount: 2,
          gapMaxSeconds: 4_000,
          gapSumSeconds: 7_000,
          pings: 3,
        },
        {
          day: '2026-10-31',
          gapCount: 2,
          gapMaxSeconds: 3_800,
          gapSumSeconds: 7_400,
          pings: 3,
        },
        {
          day: '2026-08-01',
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
