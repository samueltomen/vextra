import { Button } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'

import { listMonitors } from '../api/monitoring-api.ts'
import {
  formatFrequency,
  formatRelativeTime,
  statusLabel,
} from '../model/monitor-format.ts'
import {
  summarizeMonitors,
  type MonitorStatus,
  type StatusFilter,
  type MonitorView,
} from '../model/monitor.ts'
import { StatusBadge } from './status-badge.tsx'
import { StatusSummary } from './status-summary.tsx'

type PreviewState = 'loading' | 'empty' | 'error'

function matchesFilter(status: MonitorStatus, filter: StatusFilter): boolean {
  return filter === 'all' || status === filter
}

function getPreviewState(search: string): PreviewState | null {
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    return null
  }

  const state = new URLSearchParams(search).get('state')
  return state === 'loading' || state === 'empty' || state === 'error'
    ? state
    : null
}

export function DashboardPage() {
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const search = useLocation({ select: (location) => location.searchStr })
  const previewState = getPreviewState(search)
  const monitorsQuery = useQuery({
    queryKey: ['monitors', previewState],
    queryFn: (): Promise<readonly MonitorView[]> => {
      if (previewState === 'error') {
        return Promise.reject(new Error('Preview error'))
      }
      if (previewState === 'empty') {
        return Promise.resolve<readonly MonitorView[]>([])
      }
      if (previewState === 'loading') {
        return new Promise<readonly MonitorView[]>(() => undefined)
      }
      return listMonitors()
    },
    retry: previewState === 'error' ? false : 1,
  })

  const monitors = monitorsQuery.data ?? []
  const normalizedSearch = query.trim().toLowerCase()
  const visibleMonitors = monitors.filter(
    (monitor) =>
      matchesFilter(monitor.status, filter) &&
      (normalizedSearch.length === 0 ||
        monitor.localLabel.toLowerCase().includes(normalizedSearch) ||
        monitor.id.toLowerCase().includes(normalizedSearch)),
  )
  const summary = summarizeMonitors(monitors)

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-medium text-action">
            Centre de surveillance
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Moniteurs
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            Un coup d&apos;œil sur les heartbeats manquants, sans exposer le
            contenu de vos scripts.
          </p>
        </div>
        <Button
          className="min-h-11 bg-action px-5 font-semibold text-white"
          onPress={() => void navigate({ to: '/monitors/new' })}
          radius="md"
        >
          <Plus aria-hidden="true" size={18} />
          Créer un moniteur
        </Button>
      </header>

      <StatusSummary
        activeFilter={filter}
        onSelect={setFilter}
        summary={summary}
      />

      <section aria-labelledby="monitor-list-title">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold" id="monitor-list-title">
              Moniteurs
            </h2>
            <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-muted tabular-nums">
              {visibleMonitors.length}
            </span>
          </div>
          <div className="relative w-full max-w-sm">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              size={16}
            />
            <input
              aria-label="Rechercher un moniteur"
              className="min-h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted focus:border-action"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un libellé ou un identifiant"
              type="search"
              value={query}
            />
          </div>
        </div>

        {monitorsQuery.isPending ? (
          <div
            aria-label="Chargement des moniteurs"
            className="space-y-2"
            role="status"
          >
            {[0, 1, 2].map((item) => (
              <div
                className="h-20 animate-pulse rounded-xl border border-line bg-surface"
                key={item}
              />
            ))}
          </div>
        ) : monitorsQuery.isError ? (
          <div className="rounded-xl border border-danger-border bg-danger-bg p-5 text-danger">
            <p className="font-semibold">
              Impossible de charger les moniteurs.
            </p>
            <Button
              className="mt-4 border-danger-border text-danger"
              onPress={() => void monitorsQuery.refetch()}
              radius="md"
              variant="bordered"
            >
              <RefreshCw aria-hidden="true" size={16} />
              Réessayer
            </Button>
          </div>
        ) : visibleMonitors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
            <ShieldCheck
              aria-hidden="true"
              className="mx-auto text-action"
              size={28}
            />
            <h3 className="mt-4 text-lg font-semibold">
              {monitors.length === 0
                ? 'Aucun moniteur'
                : 'Aucun résultat pour ce filtre'}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              {monitors.length === 0
                ? 'Créez un moniteur pour commencer à détecter les exécutions silencieuses.'
                : 'Modifiez la recherche ou revenez à tous les moniteurs.'}
            </p>
            {monitors.length > 0 ? (
              <button
                className="mt-5 min-h-10 rounded-md px-3 text-sm font-medium text-action hover:bg-action-soft"
                onClick={() => {
                  setQuery('')
                  setFilter('all')
                }}
                type="button"
              >
                Réinitialiser les filtres
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {visibleMonitors.map((monitor, index) => (
              <Link
                aria-label={`${monitor.localLabel}, ${statusLabel(monitor.status)}`}
                className={`group grid min-h-20 gap-3 px-4 py-4 transition-colors hover:bg-canvas sm:grid-cols-[minmax(0,1.6fr)_auto_minmax(0,1fr)_auto] sm:items-center sm:px-5 ${
                  index > 0 ? 'border-t border-line' : ''
                }`}
                key={monitor.id}
                params={{ monitorId: monitor.id }}
                to="/monitors/$monitorId"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{monitor.localLabel}</p>
                  <p className="mt-1 text-xs text-muted">
                    {formatFrequency(monitor.intervalMinutes)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {monitor.id.slice(0, 8)}
                  </p>
                </div>
                <StatusBadge status={monitor.status} />
                <div className="grid grid-cols-2 gap-4 text-sm sm:block">
                  <p className="text-muted">
                    <span className="block text-xs text-muted">
                      Dernier signal
                    </span>
                    <span className="tabular-nums">
                      {formatRelativeTime(monitor.lastHeartbeatAtMs)}
                    </span>
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-muted">
                    <Clock3 aria-hidden="true" size={14} />
                    <span className="tabular-nums">
                      {formatRelativeTime(monitor.alertAtMs)}
                    </span>
                  </p>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="hidden text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink sm:block"
                  size={18}
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
