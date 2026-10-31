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
      className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-4"
    >
      {ITEMS.map((item, index) => {
        const Icon = item.icon

        return (
          <button
            aria-pressed={activeFilter === item.key}
            className={`flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas ${
              index > 0 ? 'lg:border-l lg:border-line' : ''
            } ${index % 2 === 1 ? 'border-l border-line lg:border-l' : ''} ${
              index >= 2 ? 'border-t border-line lg:border-t-0' : ''
            } ${activeFilter === item.key ? 'bg-action-soft' : ''}`}
            key={item.key}
            onClick={() =>
              onSelect(activeFilter === item.key ? 'all' : item.key)
            }
            type="button"
          >
            <span
              className={`flex items-center gap-2 text-sm ${item.className}`}
            >
              <Icon aria-hidden="true" size={15} />
              <span className="font-medium">{item.label}</span>
            </span>{' '}
            <span className="font-mono text-xl font-semibold tabular-nums text-ink">
              {summary[item.key]}
            </span>
          </button>
        )
      })}
    </section>
  )
}
