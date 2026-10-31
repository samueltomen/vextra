export type MetricsDayView = Readonly<{
  day: string
  durationCount: number
  durationMaxMs: number
  durationSumMs: number
  fails: number
  gapCount: number
  gapMaxSeconds: number
  gapSumSeconds: number
  pings: number
}>

export type MonitorMetricsView = Readonly<{
  days: readonly MetricsDayView[]
  totalPings: number
}>

export type MetricsSummary = Readonly<{
  avgDurationMs: number | null
  avgIntervalSeconds: number | null
  bars: readonly Readonly<{ day: string; pings: number }>[]
  /** Average gap per day in seconds, `null` when the day had no gap. */
  dailyAvgDurationMs: readonly (number | null)[]
  dailyAvgIntervalSeconds: readonly (number | null)[]
  fails30d: number
  maxDurationMs: number | null
  maxGapSeconds: number | null
  peakPings: number
  pings30d: number
  pingsToday: number
  /** Average observed interval divided by the expected one (1 = on schedule). */
  regularity: number | null
}>

const WINDOW_DAYS = 30
const DAY_MS = 86_400_000

export function summarizeMetrics(
  days: readonly MetricsDayView[],
  expectedIntervalSeconds: number,
  nowMs: number,
): MetricsSummary {
  const byDay = new Map(days.map((entry) => [entry.day, entry]))
  const bars = Array.from({ length: WINDOW_DAYS }, (_, index) => {
    const day = new Date(nowMs - (WINDOW_DAYS - 1 - index) * DAY_MS)
      .toISOString()
      .slice(0, 10)

    return { day, pings: byDay.get(day)?.pings ?? 0 }
  })
  const inWindow = bars
    .map((bar) => byDay.get(bar.day))
    .filter((entry): entry is MetricsDayView => entry !== undefined)
  const gapCount = inWindow.reduce((sum, entry) => sum + entry.gapCount, 0)
  const gapSum = inWindow.reduce((sum, entry) => sum + entry.gapSumSeconds, 0)
  const avgIntervalSeconds = gapCount > 0 ? gapSum / gapCount : null
  const durationCount = inWindow.reduce(
    (sum, entry) => sum + entry.durationCount,
    0,
  )
  const durationSum = inWindow.reduce(
    (sum, entry) => sum + entry.durationSumMs,
    0,
  )

  return {
    avgDurationMs: durationCount > 0 ? durationSum / durationCount : null,
    avgIntervalSeconds,
    bars,
    dailyAvgDurationMs: bars.map((bar) => {
      const entry = byDay.get(bar.day)

      return entry && entry.durationCount > 0
        ? entry.durationSumMs / entry.durationCount
        : null
    }),
    fails30d: inWindow.reduce((sum, entry) => sum + entry.fails, 0),
    maxDurationMs:
      durationCount > 0
        ? Math.max(...inWindow.map((entry) => entry.durationMaxMs))
        : null,
    dailyAvgIntervalSeconds: bars.map((bar) => {
      const entry = byDay.get(bar.day)

      return entry && entry.gapCount > 0
        ? entry.gapSumSeconds / entry.gapCount
        : null
    }),
    maxGapSeconds:
      inWindow.length > 0 && gapCount > 0
        ? Math.max(...inWindow.map((entry) => entry.gapMaxSeconds))
        : null,
    peakPings: Math.max(0, ...bars.map((bar) => bar.pings)),
    pings30d: bars.reduce((sum, bar) => sum + bar.pings, 0),
    pingsToday: bars.at(-1)?.pings ?? 0,
    regularity:
      avgIntervalSeconds !== null && expectedIntervalSeconds > 0
        ? avgIntervalSeconds / expectedIntervalSeconds
        : null,
  }
}

export function formatSeconds(seconds: number | null): string {
  if (seconds === null) {
    return '—'
  }

  if (seconds < 90) {
    return `${Math.round(seconds)} s`
  }

  const minutes = seconds / 60

  if (minutes < 90) {
    return `${Math.round(minutes)} min`
  }

  const hours = minutes / 60

  return hours < 48
    ? `${hours.toFixed(1).replace('.', ',')} h`
    : `${Math.round(hours / 24)} j`
}

/** Dense per-day ping counts (oldest first) ending today, UTC. */
export function denseActivity(
  days: readonly Readonly<{ day: string; pings: number }>[],
  nowMs: number,
  windowDays = 14,
): readonly number[] {
  const byDay = new Map(days.map((entry) => [entry.day, entry.pings]))

  return Array.from({ length: windowDays }, (_, index) => {
    const day = new Date(nowMs - (windowDays - 1 - index) * DAY_MS)
      .toISOString()
      .slice(0, 10)

    return byDay.get(day) ?? 0
  })
}

export function formatMilliseconds(milliseconds: number | null): string {
  if (milliseconds === null) {
    return '—'
  }

  if (milliseconds < 1_000) {
    return `${Math.round(milliseconds)} ms`
  }

  const seconds = milliseconds / 1_000

  if (seconds < 90) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0).replace('.', ',')} s`
  }

  return formatSeconds(seconds)
}
