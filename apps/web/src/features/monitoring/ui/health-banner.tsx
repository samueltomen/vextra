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
      className={`overflow-hidden rounded-2xl border p-5 shadow-card sm:p-6 ${
        hasIncident
          ? 'border-warning-border bg-warning-bg text-warning'
          : 'border-healthy-border bg-healthy-bg text-healthy'
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface/70">
          <Icon aria-hidden="true" size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight">
            {hasIncident
              ? `${summary.late} moniteur${summary.late > 1 ? 's' : ''} nécessite${
                  summary.late > 1 ? 'nt' : ''
                } votre attention`
              : 'Tous vos jobs sont dans les temps'}
          </p>
          <p className="mt-1 text-sm opacity-85">
            {summary.healthy} sur {active} moniteur{active > 1 ? 's' : ''} actif
            {active > 1 ? 's' : ''} {summary.healthy > 1 ? 'sont' : 'est'}{' '}
            opérationnel{summary.healthy > 1 ? 's' : ''}.
          </p>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface/60"
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
