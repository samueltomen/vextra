import { CircleCheck, TriangleAlert } from 'lucide-react'

import type { MonitorSummary } from '../model/monitor.ts'

const SEGMENTS = [
  { className: 'bg-healthy-solid', key: 'healthy' },
  { className: 'bg-warning-solid', key: 'late' },
  { className: 'bg-neutral-solid', key: 'paused' },
  { className: 'bg-border-strong/50', key: 'pending' },
] as const

export function HealthBanner({
  summary,
}: Readonly<{ summary: MonitorSummary }>) {
  if (summary.total === 0) {
    return null
  }

  const hasIncident = summary.late > 0
  const Icon = hasIncident ? TriangleAlert : CircleCheck
  const active = summary.total - summary.paused

  return (
    <section
      aria-label="État global"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-2.5 ${
        hasIncident
          ? 'border-warning-border bg-warning-bg text-warning'
          : 'border-healthy-border bg-healthy-bg text-healthy'
      }`}
    >
      <Icon aria-hidden="true" className="shrink-0" size={18} />
      <p className="text-sm font-semibold">
        {hasIncident
          ? `${summary.late} moniteur${summary.late > 1 ? 's' : ''} nécessite${
              summary.late > 1 ? 'nt' : ''
            } votre attention`
          : 'Tous vos jobs sont dans les temps'}
      </p>
      <p className="font-mono text-xs opacity-80">
        {summary.healthy}/{active} actif{active > 1 ? 's' : ''} opérationnel
        {summary.healthy > 1 ? 's' : ''}
      </p>
      <div
        aria-hidden="true"
        className="ml-auto flex h-1.5 w-full overflow-hidden rounded-full bg-surface/60 sm:w-48"
      >
        {SEGMENTS.map((segment) =>
          summary[segment.key] > 0 ? (
            <span
              className={segment.className}
              key={segment.key}
              style={{
                width: `${(summary[segment.key] / summary.total) * 100}%`,
              }}
            />
          ) : null,
        )}
      </div>
    </section>
  )
}
