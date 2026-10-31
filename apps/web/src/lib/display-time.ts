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
let displayHour12: boolean | undefined

export function setDisplayTimeZone(timeZone: string | undefined): void {
  displayTimeZone = timeZone
}

export function getDisplayTimeZone(): string | undefined {
  return displayTimeZone
}

export function setDisplayTimeFormat(format: '12h' | '24h'): void {
  displayHour12 = format === '12h'
}

export function timeZoneOption(): { hour12?: boolean; timeZone?: string } {
  return {
    ...(displayTimeZone ? { timeZone: displayTimeZone } : {}),
    ...(displayHour12 !== undefined ? { hour12: displayHour12 } : {}),
  }
}

export function listTimeZones(): readonly string[] {
  try {
    const supported = Intl.supportedValuesOf('timeZone')

    return supported.includes('UTC') ? supported : [...supported, 'UTC']
  } catch {
    return FALLBACK_TIME_ZONES
  }
}
