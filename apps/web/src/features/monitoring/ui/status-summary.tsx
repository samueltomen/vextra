import { CircleCheck, CirclePause, Clock3, TriangleAlert } from 'lucide-react'

import type { MonitorSummary, StatusFilter } from '../model/monitor.ts'

const ITEMS = [
  {
    key: 'healthy',
    label: 'Opérationnels',
    icon: CircleCheck,
    className: 'text-healthy',
  },
  {
    key: 'late',
    label: 'En retard',
    icon: TriangleAlert,
    className: 'text-warning',
  },
  {
    key: 'paused',
    label: 'En pause',
    icon: CirclePause,
    className: 'text-neutral',
  },
  {
    key: 'pending',
    label: 'En attente',
    icon: Clock3,
    className: 'text-muted',
  },
] as const

export function StatusSummary({
  activeFilter,
  onSelect,
  summary,
}: Readonly<{
  activeFilter: StatusFilter
  onSelect: (filter: StatusFilter) => void
  summary: MonitorSummary
}>) {
  return (
    <section
      aria-label="Résumé des statuts"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon

        return (
          <button
            aria-pressed={activeFilter === item.key}
            className={`rounded-xl border bg-surface p-4 text-left transition-colors hover:border-border-strong ${
              activeFilter === item.key
                ? 'border-action ring-1 ring-action'
                : 'border-line'
            }`}
            key={item.key}
            onClick={() =>
              onSelect(activeFilter === item.key ? 'all' : item.key)
            }
            type="button"
          >
            <div className={`flex items-center gap-2 ${item.className}`}>
              <Icon aria-hidden="true" size={17} />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
              {summary[item.key]}
            </p>
          </button>
        )
      })}
    </section>
  )
}
