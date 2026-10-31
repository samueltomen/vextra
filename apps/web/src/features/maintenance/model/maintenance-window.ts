export const DURATION_OPTIONS = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 heure', minutes: 60 },
  { label: '2 heures', minutes: 120 },
  { label: '4 heures', minutes: 240 },
  { label: '24 heures', minutes: 1_440 },
] as const

/** `datetime-local` value (browser local time) for a timestamp. */
export function toLocalInputValue(timestampMs: number): string {
  const date = new Date(
    timestampMs - new Date(timestampMs).getTimezoneOffset() * 60_000,
  )

  return date.toISOString().slice(0, 16)
}

export function buildWindowRange(
  localStart: string,
  durationMinutes: number,
): Readonly<{ endsAt: string; startsAt: string }> | null {
  const startMs = new Date(localStart).getTime()

  if (Number.isNaN(startMs)) {
    return null
  }

  return {
    endsAt: new Date(startMs + durationMinutes * 60_000).toISOString(),
    startsAt: new Date(startMs).toISOString(),
  }
}

export function windowState(
  window: Readonly<{ endsAt: string; startsAt: string }>,
  nowMs: number,
): 'active' | 'upcoming' {
  return Date.parse(window.startsAt) <= nowMs ? 'active' : 'upcoming'
}
