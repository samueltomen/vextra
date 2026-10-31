import { describe, expect, it } from 'vitest'

import {
  InvalidCronError,
  isSupportedTimeZone,
  maxCronGapSeconds,
  nextCronOccurrence,
  parseCronExpression,
  upcomingCronOccurrences,
} from './cron-schedule.ts'

const iso = (ms: number | null) =>
  ms === null ? null : new Date(ms).toISOString()
const at = (value: string) => Date.parse(value)

function next(expression: string, after: string, timeZone = 'UTC') {
  return iso(
    nextCronOccurrence(parseCronExpression(expression), at(after), timeZone),
  )
}

describe('parseCronExpression', () => {
  it('accepts lists, ranges, steps, names and shortcuts', () => {
    expect(
      parseCronExpression('*/15 0-6,12 1,15 jan-mar mon-fri').minutes,
    ).toEqual(new Set([0, 15, 30, 45]))
    expect(parseCronExpression('0 0 * * 7').daysOfWeek).toEqual(new Set([0]))
    expect(parseCronExpression('5/20 * * * *').minutes).toEqual(
      new Set([5, 25, 45]),
    )
    expect(parseCronExpression('@daily').hours).toEqual(new Set([0]))
    expect(parseCronExpression('  0   12  *  *  *  ').hours).toEqual(
      new Set([12]),
    )
  })

  it.each([
    '',
    '* * * *',
    '* * * * * *',
    '60 * * * *',
    '* 24 * * *',
    '* * 0 * *',
    '* * * 13 *',
    '* * * * 8',
    '*/0 * * * *',
    '5-1 * * * *',
    '1--2 * * * *',
    'a * * * *',
    '1,,2 * * * *',
    '1/2/3 * * * *',
    '@sometimes',
    'x'.repeat(200),
  ])('rejects %j', (expression) => {
    expect(() => parseCronExpression(expression)).toThrow(InvalidCronError)
  })
})

describe('nextCronOccurrence in UTC', () => {
  it('finds the next step, hour, weekday and month', () => {
    expect(next('*/15 * * * *', '2026-10-31T12:07:30Z')).toBe(
      '2026-10-31T12:15:00.000Z',
    )
    expect(next('0 * * * *', '2026-10-31T12:00:00Z')).toBe(
      '2026-10-31T13:00:00.000Z',
    )
    expect(next('0 9 * * 1-5', '2026-10-30T10:00:00Z')).toBe(
      '2026-11-02T09:00:00.000Z',
    )
    expect(next('0 0 1 * *', '2026-10-31T23:59:00Z')).toBe(
      '2026-11-01T00:00:00.000Z',
    )
    expect(next('30 8 * * mon', '2026-10-31T00:00:00Z')).toBe(
      '2026-11-02T08:30:00.000Z',
    )
  })

  it('is strictly after the given instant', () => {
    expect(next('0 12 * * *', '2026-10-31T12:00:00Z')).toBe(
      '2026-11-01T12:00:00.000Z',
    )
    expect(next('0 12 * * *', '2026-10-31T11:59:59Z')).toBe(
      '2026-10-31T12:00:00.000Z',
    )
  })

  it('handles leap days and impossible dates', () => {
    expect(next('0 0 29 2 *', '2026-01-01T00:00:00Z')).toBe(
      '2028-02-29T00:00:00.000Z',
    )
    expect(next('0 0 31 2 *', '2026-01-01T00:00:00Z')).toBeNull()
  })

  it('matches a day of month OR a day of week when both are restricted', () => {
    const occurrences = upcomingCronOccurrences(
      parseCronExpression('0 0 13 * 5'),
      at('2026-10-01T00:00:00Z'),
      'UTC',
      6,
    ).map((ms) => new Date(ms).toISOString().slice(0, 10))

    expect(occurrences).toEqual([
      '2026-10-02',
      '2026-10-09',
      '2026-10-13',
      '2026-10-16',
      '2026-10-23',
      '2026-10-30',
    ])
  })
})

describe('nextCronOccurrence with time zones and daylight saving', () => {
  it('uses the local clock of the zone', () => {
    // 09:00 in Paris is 08:00 UTC in winter and 07:00 UTC in summer.
    expect(next('0 9 * * *', '2026-01-15T00:00:00Z', 'Europe/Paris')).toBe(
      '2026-01-15T08:00:00.000Z',
    )
    expect(next('0 9 * * *', '2026-07-15T00:00:00Z', 'Europe/Paris')).toBe(
      '2026-07-15T07:00:00.000Z',
    )
    expect(next('0 9 * * *', '2026-07-15T00:00:00Z', 'Asia/Kolkata')).toBe(
      '2026-07-15T03:30:00.000Z',
    )
  })

  it('keeps the local hour across the spring-forward change', () => {
    // Paris moves from UTC+1 to UTC+2 on 2026-03-29 at 01:00 UTC.
    expect(next('0 3 * * *', '2026-03-28T12:00:00Z', 'Europe/Paris')).toBe(
      '2026-03-29T01:00:00.000Z',
    )
    expect(next('0 12 * * *', '2026-03-28T12:00:00Z', 'Europe/Paris')).toBe(
      '2026-03-29T10:00:00.000Z',
    )
  })

  it('runs a non-existent local time at the instant the clocks change', () => {
    expect(next('30 2 * * *', '2026-03-28T02:00:00Z', 'Europe/Paris')).toBe(
      '2026-03-29T01:00:00.000Z',
    )
  })

  it('runs a repeated local time once, the first time', () => {
    // Paris moves back from UTC+2 to UTC+1 on 2026-10-25 at 01:00 UTC.
    expect(next('30 2 * * *', '2026-10-24T12:00:00Z', 'Europe/Paris')).toBe(
      '2026-10-25T00:30:00.000Z',
    )
    expect(next('30 2 * * *', '2026-10-25T00:30:00Z', 'Europe/Paris')).toBe(
      '2026-10-26T01:30:00.000Z',
    )
    expect(next('30 2 * * *', '2026-10-25T01:10:00Z', 'Europe/Paris')).toBe(
      '2026-10-26T01:30:00.000Z',
    )
  })

  it('works in the southern hemisphere and with half-hour offsets', () => {
    // Sydney moves to UTC+11 on 2026-10-04 at 02:00 local (16:00 UTC the day before).
    expect(next('0 12 * * *', '2026-10-03T00:00:00Z', 'Australia/Sydney')).toBe(
      '2026-10-03T02:00:00.000Z',
    )
    expect(next('0 12 * * *', '2026-10-04T03:00:00Z', 'Australia/Sydney')).toBe(
      '2026-10-05T01:00:00.000Z',
    )
  })
})

describe('upcomingCronOccurrences', () => {
  it('lists occurrences in order and stops when none remain', () => {
    const list = upcomingCronOccurrences(
      parseCronExpression('0 0 * * *'),
      at('2026-10-31T00:00:00Z'),
      'UTC',
      3,
    )

    expect(list.map((ms) => new Date(ms).toISOString())).toEqual([
      '2026-11-01T00:00:00.000Z',
      '2026-11-02T00:00:00.000Z',
      '2026-11-03T00:00:00.000Z',
    ])
    expect(
      upcomingCronOccurrences(parseCronExpression('0 0 31 2 *'), 0, 'UTC', 3),
    ).toEqual([])
  })
})

describe('maxCronGapSeconds', () => {
  const gap = (expression: string, timeZone = 'UTC') =>
    maxCronGapSeconds(
      parseCronExpression(expression),
      at('2026-10-31T12:00:00Z'),
      timeZone,
    )
  const HOUR = 3_600

  it('is the longest gap plus one hour of daylight saving margin', () => {
    expect(gap('*/5 * * * *')).toBe(300 + HOUR)
    expect(gap('0 3 * * *')).toBe(86_400 + HOUR)
    expect(gap('0 9 * * 1-5')).toBe(3 * 86_400 + HOUR)
  })

  it('sees the weekend gap of a dense weekday schedule', () => {
    expect(gap('* 9-17 * * 1-5')).toBeGreaterThanOrEqual(63 * HOUR)
  })

  it('never exceeds one year and handles schedules that never match', () => {
    expect(gap('0 0 29 2 *')).toBe(31_536_000)
    expect(gap('0 0 31 2 *')).toBe(31_536_000)
  })

  it('covers the longest day of the year in a time zone with daylight saving', () => {
    expect(gap('0 0 * * *', 'Europe/Paris')).toBeGreaterThanOrEqual(25 * HOUR)
  })
})

describe('isSupportedTimeZone', () => {
  it('recognizes IANA zones and rejects other values', () => {
    expect(isSupportedTimeZone('Europe/Paris')).toBe(true)
    expect(isSupportedTimeZone('UTC')).toBe(true)
    expect(isSupportedTimeZone('Mars/Olympus')).toBe(false)
  })
})
