import { useQuery } from '@tanstack/react-query'
import {
  CircleAlert,
  CircleCheck,
  CirclePlay,
  History,
  TriangleAlert,
} from 'lucide-react'

import {
  getMonitorRuns,
  type RunView,
} from '../../workspace/api/workspace-api.ts'
import { formatDateTime } from '../model/monitor-format.ts'
import { formatMilliseconds } from '../model/metrics-summary.ts'

const KIND = {
  fail: { icon: CircleAlert, label: 'Échec', tone: 'text-danger' },
  start: { icon: CirclePlay, label: 'Début', tone: 'text-muted' },
  success: { icon: CircleCheck, label: 'Succès', tone: 'text-healthy' },
  warn: { icon: TriangleAlert, label: 'Avertissement', tone: 'text-warning' },
} as const satisfies Record<RunView['kind'], unknown>

export function MonitorRunsPanel({
  monitorId,
}: Readonly<{ monitorId: string }>) {
  const query = useQuery({
    queryFn: () => getMonitorRuns(monitorId),
    queryKey: ['monitor-runs', monitorId],
  })

  return (
    <section
      aria-labelledby="runs-title"
      className="rounded-xl border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 text-action">
        <History aria-hidden="true" size={18} />
        <h2 className="text-sm font-semibold" id="runs-title">
          Historique des exécutions
        </h2>
        <span className="ml-auto font-mono text-[11px] text-muted">
          90 jours · 50 dernières
        </span>
      </div>

      {query.isPending ? (
        <p className="mt-4 text-sm text-muted" role="status">
          Chargement de l’historique…
        </p>
      ) : query.isError ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          Impossible de charger l’historique.
        </p>
      ) : query.data.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Aucune exécution enregistrée pour l’instant. Envoyez un premier
          heartbeat pour la voir apparaître ici.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {query.data.map((run) => {
            const config = KIND[run.kind]
            const Icon = config.icon

            return (
              <li className="flex items-center gap-3 py-2 text-sm" key={run.id}>
                <Icon aria-hidden="true" className={config.tone} size={16} />
                <span className={`w-28 font-medium ${config.tone}`}>
                  {config.label}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">
                  {formatDateTime(run.createdAtMs)}
                </span>
                {run.overlapped ? (
                  <span className="rounded border border-warning-border bg-warning-bg px-1.5 text-[11px] text-warning">
                    Chevauchement
                  </span>
                ) : null}
                <span className="w-20 text-right font-mono text-xs tabular-nums">
                  {run.durationMs === null
                    ? '—'
                    : formatMilliseconds(run.durationMs)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
