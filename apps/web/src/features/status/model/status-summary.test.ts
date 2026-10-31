import { describe, expect, it } from 'vitest'

import { formatUptime, summarizeOverallStatus } from './status-summary.ts'

const monitor = (status: 'healthy' | 'late' | 'paused' | 'pending') => ({
  name: 'x',
  status,
  uptime30d: 100,
})

describe('summarizeOverallStatus', () => {
  it('is operational when no active monitor is late', () => {
    expect(
      summarizeOverallStatus({
        monitors: [monitor('healthy'), monitor('pending'), monitor('paused')],
      }),
    ).toBe('operational')
  })

  it('is degraded as soon as one monitor is late', () => {
    expect(
      summarizeOverallStatus({
        monitors: [monitor('healthy'), monitor('late')],
      }),
    ).toBe('degraded')
  })

  it('is unknown without any active monitor', () => {
    expect(summarizeOverallStatus({ monitors: [] })).toBe('unknown')
    expect(summarizeOverallStatus({ monitors: [monitor('paused')] })).toBe(
      'unknown',
    )
  })
})

describe('formatUptime', () => {
  it('formats the availability in French', () => {
    expect(formatUptime(100)).toBe('100 %')
    expect(formatUptime(99.987)).toMatch(/^99,99 %$/)
  })
})
