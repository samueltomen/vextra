export type MetricsDayRecord = Readonly<{
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

export type MonitorMetricsRecord = Readonly<{
  days: readonly MetricsDayRecord[]
  totalPings: number
}>

export type ActivityRecord = Readonly<{
  day: string
  monitorId: string
  pings: number
}>

export type RunRecord = Readonly<{
  createdAtMs: number
  durationMs: number | null
  id: string
  kind: 'fail' | 'start' | 'success' | 'warn'
  overlapped: boolean
}>

export const RUNS_PAGE_SIZE = 50

export interface MonitorMetricsPort {
  runs(
    tenantId: string,
    monitorId: string,
    limit: number,
  ): Promise<readonly RunRecord[] | null>
  activity(
    tenantId: string,
    sinceDay: string,
  ): Promise<readonly ActivityRecord[]>
  find(
    tenantId: string,
    monitorId: string,
    sinceDay: string,
  ): Promise<MonitorMetricsRecord | null>
}

export const METRICS_WINDOW_DAYS = 30
export const ACTIVITY_WINDOW_DAYS = 14

export class MonitorMetricsService {
  constructor(
    private readonly dependencies: Readonly<{
      nowMs: () => number
      port: MonitorMetricsPort
    }>,
  ) {}

  activity(tenantId: string): Promise<readonly ActivityRecord[]> {
    const since = new Date(
      this.dependencies.nowMs() - (ACTIVITY_WINDOW_DAYS - 1) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10)

    return this.dependencies.port.activity(tenantId, since)
  }

  runs(
    tenantId: string,
    monitorId: string,
  ): Promise<readonly RunRecord[] | null> {
    return this.dependencies.port.runs(tenantId, monitorId, RUNS_PAGE_SIZE)
  }

  get(
    tenantId: string,
    monitorId: string,
  ): Promise<MonitorMetricsRecord | null> {
    const since = new Date(
      this.dependencies.nowMs() - (METRICS_WINDOW_DAYS - 1) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10)

    return this.dependencies.port.find(tenantId, monitorId, since)
  }
}
