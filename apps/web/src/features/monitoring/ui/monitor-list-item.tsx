import { Link } from '@tanstack/react-router'
import { ArrowRight, Clock3 } from 'lucide-react'

import {
  formatFrequency,
  formatRelativeTime,
  statusLabel,
} from '../model/monitor-format.ts'
import type { MonitorStatus, MonitorView } from '../model/monitor.ts'
import { getDueProgress } from '../model/monitor-timing.ts'
import { StatusBadge } from './status-badge.tsx'

const DOT_CLASS: Record<MonitorStatus, string> = {
  healthy: 'bg-healthy-solid',
  late: 'bg-warning-solid cp-pulse text-warning-solid',
  paused: 'bg-neutral-solid',
  pending: 'bg-border-strong/60',
}

function DueProgress({
  monitor,
  nowMs,
}: Readonly<{ monitor: MonitorView; nowMs: number }>) {
  const progress = getDueProgress(monitor, nowMs)

  if (!progress) {
    return <p className="text-xs text-muted">Surveillance suspendue</p>
  }

  return (
    <div>
      <div
        aria-hidden="true"
        className="h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div
          className={`h-full rounded-full transition-[width] ${
            progress.overdue ? 'bg-warning-solid' : 'bg-action'
          }`}
          style={{ width: `${Math.round(progress.fraction * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
        <Clock3 aria-hidden="true" size={13} />
        <span className="tabular-nums">
          {progress.overdue ? 'Échéance dépassée ' : 'Échéance '}
          {formatRelativeTime(monitor.alertAtMs)}
        </span>
      </p>
    </div>
  )
}

export function MonitorListItem({
  index,
  monitor,
  nowMs,
  view,
}: Readonly<{
  index: number
  monitor: MonitorView
  nowMs: number
  view: 'grid' | 'list'
}>) {
  const label = `${monitor.localLabel}, ${statusLabel(monitor.status)}`
  const dot = (
    <span
      aria-hidden="true"
      className={`mt-1.5 size-2.5 shrink-0 rounded-full ${DOT_CLASS[monitor.status]}`}
    />
  )
  const title = (
    <div className="flex min-w-0 gap-3">
      {dot}
      <div className="min-w-0">
        <p className="truncate font-semibold">{monitor.localLabel}</p>
        <p className="mt-1 text-xs text-muted">
          {formatFrequency(monitor.intervalMinutes)}
          <span className="mx-1.5">·</span>
          <span className="font-mono">{monitor.id.slice(0, 8)}</span>
        </p>
      </div>
    </div>
  )

  if (view === 'grid') {
    return (
      <Link
        aria-label={label}
        className="group flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raised"
        params={{ monitorId: monitor.id }}
        to="/monitors/$monitorId"
      >
        <div className="flex items-start justify-between gap-3">
          {title}
          <StatusBadge status={monitor.status} />
        </div>
        <DueProgress monitor={monitor} nowMs={nowMs} />
        <p className="flex items-center justify-between border-t border-line pt-4 text-xs text-muted">
          <span>
            Dernier signal{' '}
            <span className="font-medium text-ink tabular-nums">
              {formatRelativeTime(monitor.lastHeartbeatAtMs)}
            </span>
          </span>
          <ArrowRight
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
            size={16}
          />
        </p>
      </Link>
    )
  }

  return (
    <Link
      aria-label={label}
      className={`group grid gap-4 px-4 py-4 transition-colors hover:bg-canvas sm:px-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(10rem,1fr)_auto_auto_auto] lg:items-center ${
        index > 0 ? 'border-t border-line' : ''
      }`}
      params={{ monitorId: monitor.id }}
      to="/monitors/$monitorId"
    >
      {title}
      <DueProgress monitor={monitor} nowMs={nowMs} />
      <StatusBadge status={monitor.status} />
      <p className="text-xs text-muted lg:w-28 lg:text-right">
        Dernier signal
        <span className="block text-sm font-medium text-ink tabular-nums">
          {formatRelativeTime(monitor.lastHeartbeatAtMs)}
        </span>
      </p>
      <ArrowRight
        aria-hidden="true"
        className="hidden text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink lg:block"
        size={18}
      />
    </Link>
  )
}
