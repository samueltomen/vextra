import { Chip } from '@heroui/react'
import { CircleCheck, CirclePause, Clock3, TriangleAlert } from 'lucide-react'

import type { MonitorStatus } from '../model/monitor.ts'

const STATUS_CONFIG = {
  healthy: {
    className: 'border-healthy-border bg-healthy-bg text-healthy',
    icon: CircleCheck,
    label: 'Opérationnel',
  },
  late: {
    className: 'border-warning-border bg-warning-bg text-warning',
    icon: TriangleAlert,
    label: 'En retard',
  },
  paused: {
    className: 'border-neutral-border bg-neutral-bg text-neutral',
    icon: CirclePause,
    label: 'En pause',
  },
  pending: {
    className: 'border-line bg-surface text-muted',
    icon: Clock3,
    label: 'En attente',
  },
} as const

export function StatusBadge({ status }: Readonly<{ status: MonitorStatus }>) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <span className="inline-flex">
      <Chip
        className={`border ${config.className}`}
        size="sm"
        startContent={<Icon aria-hidden="true" size={14} />}
        variant="flat"
      >
        {config.label}
      </Chip>
    </span>
  )
}
