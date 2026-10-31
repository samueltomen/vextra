import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'

import { TimeSeriesChart } from '../../../components/time-series-chart.tsx'
import { getMonitorMetrics } from '../../workspace/api/workspace-api.ts'
import {
  formatSeconds,
  summarizeMetrics,
  type MetricsSummary,
} from '../model/metrics-summary.ts'

function formatDayLabel(day: string): string {
  const [, month, date] = day.split('-')

  return `${date}/${month}`
}

function Stat({
  hint,
  label,
  value,
}: Readonly<{ hint?: string | undefined; label: string; value: string }>) {
  return (
    <div className="rounded-lg border border-line bg-canvas/40 px-3 py-2.5">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
        {value}
      </p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

function describeRegularity(summary: MetricsSummary): string | undefined {
  if (summary.regularity === null) {
    return undefined
  }

  const percent = Math.round(summary.regularity * 100)

  return `${percent} % de l’intervalle attendu`
}

export function MonitorMetricsPanel({
  intervalMinutes,
  monitorId,
  nowMs,
}: Readonly<{ intervalMinutes: number; monitorId: string; nowMs: number }>) {
  const query = useQuery({
    queryFn: () => getMonitorMetrics(monitorId, intervalMinutes),
    queryKey: ['monitor-metrics', monitorId],
    refetchInterval: 60_000,
  })

  return (
    <section
      aria-labelledby="metrics-title"
      className="rounded-xl border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 text-action">
        <Activity aria-hidden="true" size={18} />
        <h2 className="text-sm font-semibold" id="metrics-title">
          Activité des heartbeats
        </h2>
      </div>

      {query.isPending ? (
        <p className="mt-4 text-sm text-muted" role="status">
          Chargement des métriques…
        </p>
      ) : query.isError ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          Impossible de charger les métriques.
        </p>
      ) : (
        <MetricsBody
          intervalMinutes={intervalMinutes}
          nowMs={nowMs}
          query={query.data}
        />
      )}
    </section>
  )
}

function MetricsBody({
  intervalMinutes,
  nowMs,
  query,
}: Readonly<{
  intervalMinutes: number
  nowMs: number
  query: NonNullable<Awaited<ReturnType<typeof getMonitorMetrics>>>
}>) {
  const summary = summarizeMetrics(query.days, intervalMinutes * 60, nowMs)
  const labels = summary.bars.map((bar) => formatDayLabel(bar.day))

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total reçus" value={String(query.totalPings)} />
        <Stat label="30 derniers jours" value={String(summary.pings30d)} />
        <Stat label="Aujourd’hui" value={String(summary.pingsToday)} />
        <Stat
          hint={describeRegularity(summary)}
          label="Intervalle moyen"
          value={formatSeconds(summary.avgIntervalSeconds)}
        />
        <Stat
          label="Plus long intervalle"
          value={formatSeconds(summary.maxGapSeconds)}
        />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
            Heartbeats par jour
          </h3>
          <TimeSeriesChart
            ariaLabel="Heartbeats reçus par jour sur 30 jours"
            formatValue={(value) => String(Math.round(value))}
            integerTicks
            labels={labels}
            series={[
              {
                color: 'var(--cp-color-action)',
                name: 'Heartbeats',
                values: summary.bars.map((bar) => bar.pings),
              },
            ]}
          />
        </div>
        <div>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
            Intervalle moyen par jour
          </h3>
          <TimeSeriesChart
            ariaLabel="Intervalle moyen entre heartbeats sur 30 jours"
            formatValue={(value) => formatSeconds(value)}
            labels={labels}
            reference={{
              label: `attendu ${formatSeconds(intervalMinutes * 60)}`,
              value: intervalMinutes * 60,
            }}
            series={[
              {
                color: 'var(--cp-color-healthy-solid)',
                name: 'Intervalle',
                values: summary.dailyAvgIntervalSeconds,
              },
            ]}
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        Compteurs uniquement : ni contenu, ni IP, ni journal du script.
      </p>
    </>
  )
}
