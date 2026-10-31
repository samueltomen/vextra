export type MetricsDayRecord = Readonly<{
  day: string
  gapCount: number
  gapMaxSeconds: number
  gapSumSeconds: number
  pings: number
}>

export type MonitorMetricsRecord = Readonly<{
  days: readonly MetricsDayRecord[]
  totalPings: number
}>

export interface MonitorMetricsPort {
  find(
    tenantId: string,
    monitorId: string,
    sinceDay: string,
  ): Promise<MonitorMetricsRecord | null>
}

export const METRICS_WINDOW_DAYS = 30

export class MonitorMetricsService {
  constructor(
    private readonly dependencies: Readonly<{
      nowMs: () => number
      port: MonitorMetricsPort
    }>,
  ) {}

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
