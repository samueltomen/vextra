const FALLBACK_TIME_ZONES = [
  'Europe/Paris',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
] as const

let displayTimeZone: string | undefined

export function setDisplayTimeZone(timeZone: string | undefined): void {
  displayTimeZone = timeZone
}

export function getDisplayTimeZone(): string | undefined {
  return displayTimeZone
}

export function timeZoneOption(): { timeZone?: string } {
  return displayTimeZone ? { timeZone: displayTimeZone } : {}
}

export function listTimeZones(): readonly string[] {
  try {
    const supported = Intl.supportedValuesOf('timeZone')

    return supported.includes('UTC') ? supported : [...supported, 'UTC']
  } catch {
    return FALLBACK_TIME_ZONES
  }
}
