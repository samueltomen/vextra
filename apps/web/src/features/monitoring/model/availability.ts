export type AvailabilityIncident = Readonly<{
  openedAtMs: number
  resolvedAtMs: number | null
}>

export type AvailabilityDayState = 'degraded' | 'down' | 'none' | 'up'

export type AvailabilityDay = Readonly<{
  downMs: number
  startMs: number
  state: AvailabilityDayState
}>

export type Availability = Readonly<{
  days: readonly AvailabilityDay[]
  incidentCount: number
  mttrMs: number | null
  uptimePercent: number | null
}>

const DAY_MS = 86_400_000
const MIN_OBSERVED_MS = 60_000
const DOWN_DAY_RATIO = 0.25

function overlapMs(
  incident: AvailabilityIncident,
  fromMs: number,
  toMs: number,
  nowMs: number,
): number {
  const start = Math.max(incident.openedAtMs, fromMs)
  const end = Math.min(incident.resolvedAtMs ?? nowMs, toMs)

  return Math.max(0, end - start)
}

export function computeAvailability({
  createdAtMs,
  incidents,
  nowMs,
  windowDays = 30,
}: Readonly<{
  createdAtMs: number
  incidents: readonly AvailabilityIncident[]
  nowMs: number
  windowDays?: number
}>): Availability {
  const windowStartMs = nowMs - windowDays * DAY_MS
  const observedStartMs = Math.max(createdAtMs, windowStartMs)
  const observedMs = nowMs - observedStartMs

  const days = Array.from(
    { length: windowDays },
    (_, index): AvailabilityDay => {
      const startMs = windowStartMs + index * DAY_MS
      const endMs = startMs + DAY_MS
      const dayObservedStartMs = Math.max(startMs, createdAtMs)

      if (endMs <= createdAtMs) {
        return { downMs: 0, startMs, state: 'none' }
      }

      const downMs = incidents.reduce(
        (total, incident) =>
          total + overlapMs(incident, dayObservedStartMs, endMs, nowMs),
        0,
      )
      const observedDayMs = Math.max(1, endMs - dayObservedStartMs)

      if (downMs === 0) {
        return { downMs, startMs, state: 'up' }
      }

      return {
        downMs,
        startMs,
        state: downMs / observedDayMs >= DOWN_DAY_RATIO ? 'down' : 'degraded',
      }
    },
  )

  const windowIncidents = incidents.filter(
    (incident) =>
      (incident.resolvedAtMs ?? nowMs) >= windowStartMs &&
      incident.openedAtMs <= nowMs,
  )
  const resolved = windowIncidents.filter(
    (incident) => incident.resolvedAtMs !== null,
  )
  const mttrMs =
    resolved.length === 0
      ? null
      : resolved.reduce(
          (total, incident) =>
            total + ((incident.resolvedAtMs ?? 0) - incident.openedAtMs),
          0,
        ) / resolved.length

  if (observedMs < MIN_OBSERVED_MS) {
    return {
      days,
      incidentCount: windowIncidents.length,
      mttrMs,
      uptimePercent: null,
    }
  }

  const downMs = incidents.reduce(
    (total, incident) =>
      total + overlapMs(incident, observedStartMs, nowMs, nowMs),
    0,
  )

  return {
    days,
    incidentCount: windowIncidents.length,
    mttrMs,
    uptimePercent: Math.max(0, (1 - downMs / observedMs) * 100),
  }
}

export function formatDuration(durationMs: number): string {
  const minutes = Math.max(1, Math.round(durationMs / 60_000))

  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60

  if (hours < 24) {
    return restMinutes === 0 ? `${hours} h` : `${hours} h ${restMinutes} min`
  }

  const days = Math.floor(hours / 24)
  const restHours = hours % 24

  return restHours === 0 ? `${days} j` : `${days} j ${restHours} h`
}

export function formatUptime(percent: number | null): string {
  if (percent === null) {
    return '—'
  }

  const rounded = percent >= 99.995 ? 100 : Math.floor(percent * 100) / 100

  return `${rounded.toLocaleString('fr-FR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: rounded === 100 ? 0 : 2,
  })} %`
}
