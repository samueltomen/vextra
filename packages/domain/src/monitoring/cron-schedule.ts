/**
 * Standard five-field cron expressions evaluated in an IANA time zone.
 *
 * Supported syntax: `*`, lists (`1,15`), ranges (`1-5`), steps (every ten
 * minutes, `1-30/5`, `5/15`), month and day names (`jan`, `mon-fri`), `7` as Sunday and
 * the `@hourly`, `@daily`, `@weekly`, `@monthly`, `@yearly` shortcuts. When both
 * the day of month and the day of week are restricted, a day matches if EITHER
 * matches (classic cron behavior).
 *
 * Daylight saving time:
 * - a wall-clock time that does not exist (spring forward) runs at the instant
 *   the clocks change;
 * - a wall-clock time that happens twice (fall back) runs once, the first time.
 */

export class InvalidCronError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidCronError'
  }
}

export type CronSchedule = Readonly<{
  daysOfMonth: ReadonlySet<number>
  daysOfWeek: ReadonlySet<number>
  domRestricted: boolean
  dowRestricted: boolean
  hours: ReadonlySet<number>
  minutes: ReadonlySet<number>
  months: ReadonlySet<number>
}>

const MAX_EXPRESSION_LENGTH = 120
const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const MAX_INTERVAL_SECONDS = 31_536_000
const MIN_INTERVAL_SECONDS = 60

const ALIASES: Readonly<Record<string, string>> = {
  '@annually': '0 0 1 1 *',
  '@daily': '0 0 * * *',
  '@hourly': '0 * * * *',
  '@midnight': '0 0 * * *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@yearly': '0 0 1 1 *',
}

const MONTH_NAMES = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
]
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function parseNumber(
  token: string,
  names: readonly string[] | undefined,
  offset: number,
): number {
  const lower = token.toLowerCase()

  if (names) {
    const index = names.indexOf(lower)

    if (index >= 0) {
      return index + offset
    }
  }

  if (!/^\d{1,2}$/u.test(token)) {
    throw new InvalidCronError(`Invalid value "${token}"`)
  }

  return Number(token)
}

function parseField(
  raw: string,
  min: number,
  max: number,
  names?: readonly string[],
  nameOffset = 0,
): Readonly<{ restricted: boolean; values: ReadonlySet<number> }> {
  const values = new Set<number>()

  for (const part of raw.split(',')) {
    if (part.length === 0) {
      throw new InvalidCronError('Empty list item')
    }

    const [base = '', stepToken, extra] = part.split('/')

    if (extra !== undefined) {
      throw new InvalidCronError(`Invalid step in "${part}"`)
    }

    let step = 1

    if (stepToken !== undefined) {
      if (!/^\d{1,3}$/u.test(stepToken) || Number(stepToken) < 1) {
        throw new InvalidCronError(`Invalid step "${stepToken}"`)
      }

      step = Number(stepToken)
    }

    let start: number
    let end: number

    if (base === '*') {
      start = min
      end = max
    } else if (base.includes('-')) {
      const [from = '', to = '', more] = base.split('-')

      if (more !== undefined) {
        throw new InvalidCronError(`Invalid range "${base}"`)
      }

      start = parseNumber(from, names, nameOffset)
      end = parseNumber(to, names, nameOffset)
    } else {
      start = parseNumber(base, names, nameOffset)
      end = stepToken === undefined ? start : max
    }

    if (start < min || end > max || start > end) {
      throw new InvalidCronError(`Value out of range in "${part}"`)
    }

    for (let value = start; value <= end; value += step) {
      values.add(value)
    }
  }

  return { restricted: !raw.startsWith('*'), values }
}

export function parseCronExpression(expression: string): CronSchedule {
  const trimmed = expression.trim()

  if (trimmed.length === 0 || trimmed.length > MAX_EXPRESSION_LENGTH) {
    throw new InvalidCronError('Expression length is not valid')
  }

  const resolved = ALIASES[trimmed.toLowerCase()] ?? trimmed
  const fields = resolved.split(/\s+/u)

  if (fields.length !== 5) {
    throw new InvalidCronError('A cron expression has exactly five fields')
  }

  const [minute = '', hour = '', dom = '', month = '', dow = ''] = fields
  const minutes = parseField(minute, 0, 59)
  const hours = parseField(hour, 0, 23)
  const daysOfMonth = parseField(dom, 1, 31)
  const months = parseField(month, 1, 12, MONTH_NAMES, 1)
  const daysOfWeek = parseField(dow, 0, 7, DAY_NAMES, 0)

  // 7 is another way to write Sunday.
  const weekdays = new Set(
    [...daysOfWeek.values].map((value) => (value === 7 ? 0 : value)),
  )

  return {
    daysOfMonth: daysOfMonth.values,
    daysOfWeek: weekdays,
    domRestricted: daysOfMonth.restricted,
    dowRestricted: daysOfWeek.restricted,
    hours: hours.values,
    minutes: minutes.values,
    months: months.values,
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      hour: 'numeric',
      hourCycle: 'h23',
      minute: 'numeric',
      month: 'numeric',
      second: 'numeric',
      timeZone,
      year: 'numeric',
    })
    formatters.set(timeZone, formatter)
  }

  return formatter
}

export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone)

    return true
  } catch {
    return false
  }
}

type Wall = Readonly<{
  day: number
  hour: number
  minute: number
  month: number
  year: number
}>

function wallOf(utcMs: number, timeZone: string): Wall & { second: number } {
  const parts: Record<string, number> = {}

  for (const part of formatterFor(timeZone).formatToParts(utcMs)) {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value)
    }
  }

  return {
    day: parts['day'] ?? 1,
    hour: parts['hour'] === 24 ? 0 : (parts['hour'] ?? 0),
    minute: parts['minute'] ?? 0,
    month: parts['month'] ?? 1,
    second: parts['second'] ?? 0,
    year: parts['year'] ?? 1970,
  }
}

function wallAsUtc(wall: Wall): number {
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)
}

/** Offset (local minus UTC, in ms) in force at the given instant. */
function offsetAt(utcMs: number, timeZone: string): number {
  const wall = wallOf(utcMs, timeZone)
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  )

  return asUtc - Math.floor(utcMs / 1_000) * 1_000
}

function sameWall(left: Wall, right: Wall): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  )
}

/** Converts a wall-clock time to an instant, following the DST rules above. */
function wallToUtc(wall: Wall, timeZone: string): number {
  const asUtc = wallAsUtc(wall)
  const before = offsetAt(asUtc - DAY_MS, timeZone)
  const after = offsetAt(asUtc + DAY_MS, timeZone)
  const candidates = [...new Set([asUtc - before, asUtc - after])]
  const valid = candidates.filter((candidate) =>
    sameWall(wallOf(candidate, timeZone), wall),
  )

  if (valid.length > 0) {
    return Math.min(...valid)
  }

  // The wall time falls in a gap: run at the instant the clocks change.
  const earliest = Math.min(...candidates)
  const latest = Math.max(...candidates)
  let low = Math.floor(earliest / MINUTE_MS)
  let high = Math.ceil(latest / MINUTE_MS)
  const target = Math.max(before, after)

  while (low < high) {
    const middle = Math.floor((low + high) / 2)

    if (offsetAt(middle * MINUTE_MS, timeZone) === target) {
      high = middle
    } else {
      low = middle + 1
    }
  }

  return low * MINUTE_MS
}

function dayMatches(
  schedule: CronSchedule,
  year: number,
  month: number,
  day: number,
): boolean {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const byMonth = schedule.daysOfMonth.has(day)
  const byWeek = schedule.daysOfWeek.has(weekday)

  if (schedule.domRestricted && schedule.dowRestricted) {
    return byMonth || byWeek
  }

  if (schedule.domRestricted) {
    return byMonth
  }

  if (schedule.dowRestricted) {
    return byWeek
  }

  return true
}

const MAX_STEPS = 300_000
const MAX_YEARS_AHEAD = 8

/**
 * First occurrence strictly after `afterMs`, as a UTC timestamp, or `null` when
 * the expression can never match (for example `0 0 31 2 *`).
 */
export function nextCronOccurrence(
  schedule: CronSchedule,
  afterMs: number,
  timeZone: string,
): number | null {
  const startUtc = (Math.floor(afterMs / MINUTE_MS) + 1) * MINUTE_MS
  const start = wallOf(startUtc, timeZone)
  let cursor = new Date(wallAsUtc(start))
  const lastYear = start.year + MAX_YEARS_AHEAD

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth() + 1
    const day = cursor.getUTCDate()
    const hour = cursor.getUTCHours()
    const minute = cursor.getUTCMinutes()

    if (year > lastYear) {
      return null
    }

    if (!schedule.months.has(month)) {
      cursor = new Date(Date.UTC(year, month, 1))
    } else if (!dayMatches(schedule, year, month, day)) {
      cursor = new Date(Date.UTC(year, month - 1, day + 1))
    } else if (!schedule.hours.has(hour)) {
      cursor = new Date(Date.UTC(year, month - 1, day, hour + 1))
    } else if (!schedule.minutes.has(minute)) {
      cursor = new Date(Date.UTC(year, month - 1, day, hour, minute + 1))
    } else {
      const utc = wallToUtc({ day, hour, minute, month, year }, timeZone)

      if (utc >= startUtc) {
        return utc
      }

      cursor = new Date(Date.UTC(year, month - 1, day, hour, minute + 1))
    }
  }

  return null
}

/** The next `count` occurrences after `fromMs`, for previews. */
export function upcomingCronOccurrences(
  schedule: CronSchedule,
  fromMs: number,
  timeZone: string,
  count: number,
): readonly number[] {
  const occurrences: number[] = []
  let cursor = fromMs

  while (occurrences.length < count) {
    const next = nextCronOccurrence(schedule, cursor, timeZone)

    if (next === null) {
      break
    }

    occurrences.push(next)
    cursor = next
  }

  return occurrences
}

const SAMPLE_HORIZON_MS = 400 * DAY_MS
const SAMPLE_MAX_OCCURRENCES = 20_000

/**
 * Longest gap between two consecutive occurrences, in seconds, with a margin of
 * one hour for daylight saving time, clamped to the supported interval range.
 * Used as the interval of a cron monitor so that a deadline is never earlier
 * than the real next run.
 */
export function maxCronGapSeconds(
  schedule: CronSchedule,
  fromMs: number,
  timeZone: string,
): number {
  let previous = nextCronOccurrence(schedule, fromMs, timeZone)

  if (previous === null) {
    return MAX_INTERVAL_SECONDS
  }

  const horizon = previous + SAMPLE_HORIZON_MS
  let largest = 0

  for (let count = 0; count < SAMPLE_MAX_OCCURRENCES; count += 1) {
    const next = nextCronOccurrence(schedule, previous, timeZone)

    if (next === null) {
      largest = MAX_INTERVAL_SECONDS * 1_000

      break
    }

    largest = Math.max(largest, next - previous)
    previous = next

    if (previous >= horizon) {
      break
    }
  }

  if (previous < horizon && largest === 0) {
    largest = MAX_INTERVAL_SECONDS * 1_000
  }

  const seconds = Math.ceil((largest + HOUR_MS) / 1_000)

  return Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, seconds))
}
