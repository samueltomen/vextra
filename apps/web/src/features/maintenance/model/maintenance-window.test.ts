import { describe, expect, it } from 'vitest'

import {
  buildWindowRange,
  toLocalInputValue,
  windowState,
} from './maintenance-window.ts'

describe('buildWindowRange', () => {
  it('builds ISO bounds from a local start and a duration', () => {
    const range = buildWindowRange('2026-11-02T02:00', 90)

    expect(range).not.toBeNull()
    expect(Date.parse(range!.endsAt) - Date.parse(range!.startsAt)).toBe(
      90 * 60_000,
    )
  })

  it('rejects an empty or invalid start', () => {
    expect(buildWindowRange('', 30)).toBeNull()
    expect(buildWindowRange('pas une date', 30)).toBeNull()
  })
})

describe('toLocalInputValue', () => {
  it('round-trips through the browser local time', () => {
    const now = Date.parse('2026-11-02T10:30:00.000Z')

    expect(new Date(toLocalInputValue(now)).getTime()).toBe(now)
  })
})

describe('windowState', () => {
  it('tells running windows from upcoming ones', () => {
    const win = {
      endsAt: '2026-11-02T04:00:00.000Z',
      startsAt: '2026-11-02T02:00:00.000Z',
    }

    expect(windowState(win, Date.parse('2026-11-02T03:00:00.000Z'))).toBe(
      'active',
    )
    expect(windowState(win, Date.parse('2026-11-02T01:00:00.000Z'))).toBe(
      'upcoming',
    )
  })
})
