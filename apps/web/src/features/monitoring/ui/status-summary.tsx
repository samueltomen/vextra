import { CircleCheck, CirclePause, Clock3, TriangleAlert } from 'lucide-react'

import type { MonitorSummary } from '../model/monitor.ts'

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
  summary,
}: Readonly<{ summary: MonitorSummary }>) {
  return (
    <section
      aria-label="Résumé des statuts"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon

        return (
          <div
            className="rounded-xl border border-line bg-surface p-4"
            key={item.key}
          >
            <div className={`flex items-center gap-2 ${item.className}`}>
              <Icon aria-hidden="true" size={17} />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {summary[item.key]}
            </p>
          </div>
        )
      })}
    </section>
  )
}
