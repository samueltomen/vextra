import { Link } from '@tanstack/react-router'
import { ArrowRight, BellOff, Clock3 } from 'lucide-react'

import { formatRelativeTime, statusLabel } from '../model/monitor-format.ts'
import { describeSchedule } from '../model/cron-schedule.ts'
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
        className="h-1 overflow-hidden rounded-full bg-line"
      >
        <div
          className={`h-full rounded-full transition-[width] ${
            progress.overdue ? 'bg-warning-solid' : 'bg-action'
          }`}
          style={{ width: `${Math.round(progress.fraction * 100)}%` }}
        />
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
        <Clock3 aria-hidden="true" size={13} />
        <span className="tabular-nums">
          {progress.overdue ? 'Échéance dépassée ' : 'Échéance '}
          {formatRelativeTime(monitor.alertAtMs)}
        </span>
      </p>
    </div>
  )
}

function ActivityStrip({
  values,
}: Readonly<{ values: readonly number[] | undefined }>) {
  const peak = Math.max(1, ...(values ?? []))

  return (
    <div
      aria-hidden="true"
      className="hidden h-6 items-end gap-px lg:flex"
      title="Heartbeats reçus par jour sur 14 jours"
    >
      {(values ?? Array.from({ length: 14 }, () => 0)).map((value, index) => (
        <span
          className={`w-1 rounded-[1px] ${value > 0 ? 'bg-healthy-solid' : 'bg-line'}`}
          key={index}
          style={{
            height: `${value > 0 ? Math.max(25, (value / peak) * 100) : 12}%`,
          }}
        />
      ))}
    </div>
  )
}

export function MonitorListItem({
  activity,
  index,
  monitor,
  nowMs,
  view,
}: Readonly<{
  activity?: readonly number[] | undefined
  index: number
  monitor: MonitorView
  nowMs: number
  view: 'grid' | 'list'
}>) {
  const label = `${monitor.localLabel}, ${statusLabel(monitor.status)}`
  const dot = (
    <span
      aria-hidden="true"
      className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT_CLASS[monitor.status]}`}
    />
  )
  const title = (
    <div className="flex min-w-0 gap-3">
      {dot}
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{monitor.localLabel}</span>
          {monitor.alertsEnabled ? null : (
            <span
              className="shrink-0 text-muted"
              title="Alertes désactivées pour ce moniteur"
            >
              <BellOff aria-hidden="true" size={13} />
              <span className="sr-only">Alertes désactivées</span>
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {describeSchedule(monitor)}
          <span className="mx-1.5">·</span>
          <span className="font-mono">{monitor.id.slice(0, 8)}</span>
        </p>
        {monitor.tags.length > 0 ? (
          <p className="mt-1.5 flex flex-wrap gap-1">
            {monitor.tags.map((tag) => (
              <span
                className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </div>
  )

  if (view === 'grid') {
    return (
      <Link
        aria-label={label}
        className="group flex flex-col gap-5 rounded-lg border border-line bg-surface p-4 transition-colors hover:border-border-strong"
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
      className={`group grid gap-3 px-4 py-2.5 transition-colors hover:bg-canvas lg:grid-cols-[minmax(0,1.5fr)_minmax(10rem,1fr)_8.5rem_7.5rem_9.5rem_1rem] lg:items-center lg:gap-4 ${
        index > 0 ? 'border-t border-line' : ''
      }`}
      params={{ monitorId: monitor.id }}
      to="/monitors/$monitorId"
    >
      {title}
      <DueProgress monitor={monitor} nowMs={nowMs} />
      <StatusBadge status={monitor.status} />
      <ActivityStrip values={activity} />
      <p className="font-mono text-xs text-muted lg:text-right">
        <span className="text-ink tabular-nums">
          {formatRelativeTime(monitor.lastHeartbeatAtMs)}
        </span>
      </p>
      <ArrowRight
        aria-hidden="true"
        className="hidden text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink lg:block"
        size={14}
      />
    </Link>
  )
}
