import { Button, Select, SelectItem } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  Code2,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  SearchX,
  TimerReset,
} from 'lucide-react'
import { useState } from 'react'

import { useNow } from '../../../lib/use-now.ts'
import { listMonitors } from '../api/monitoring-api.ts'
import {
  summarizeMonitors,
  type MonitorStatus,
  type MonitorView,
  type StatusFilter,
} from '../model/monitor.ts'
import {
  sortMonitors,
  withEffectiveStatus,
  type MonitorSort,
} from '../model/monitor-timing.ts'
import { HealthBanner } from './health-banner.tsx'
import {
  matchesFolder,
  useFolders,
  type FolderFilter,
} from '../../workspace/query/use-folders.ts'
import { usePreferences } from '../../workspace/query/use-preferences.ts'
import { getMonitorsActivity } from '../../workspace/api/workspace-api.ts'
import { FolderBar } from '../../workspace/ui/folder-bar.tsx'
import { MonitorListItem } from './monitor-list-item.tsx'
import { StatusSummary } from './status-summary.tsx'

type PreviewState = 'loading' | 'empty' | 'error'
type DashboardView = 'grid' | 'list'

const VIEW_STORAGE_KEY = 'cronping.dashboard-view'
const REFRESH_INTERVAL_MS = 30_000

const SORT_OPTIONS = [
  ['priority', 'Priorité'],
  ['name', 'Nom'],
  ['signal', 'Dernier signal'],
  ['recent', 'Plus récents'],
] as const satisfies readonly (readonly [MonitorSort, string])[]

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

function readStoredView(): DashboardView | null {
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)

    return stored === 'grid' || stored === 'list' ? stored : null
  } catch {
    return null
  }
}

function storeView(view: DashboardView): void {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view)
  } catch {
    // La préférence de vue est un confort : on continue sans persistance.
  }
}

function OnboardingCard({ onCreate }: Readonly<{ onCreate: () => void }>) {
  const steps = [
    {
      description: 'Choisissez la fréquence attendue et une marge de retard.',
      icon: TimerReset,
      title: 'Décrivez votre tâche',
    },
    {
      description: 'Copiez la commande dans votre cron, CI ou script.',
      icon: Code2,
      title: 'Ajoutez le heartbeat',
    },
    {
      description: 'Recevez un e-mail dès que le signal ne revient plus.',
      icon: Rocket,
      title: 'Soyez alerté',
    },
  ] as const

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="p-6 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-xl bg-action-soft text-action">
          <Rocket aria-hidden="true" size={26} />
        </span>
        <h3 className="mt-5 text-xl font-semibold">Aucun moniteur</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Créez un moniteur pour commencer à détecter les exécutions
          silencieuses. Il faut moins de deux minutes.
        </p>
        <Button
          className="mt-6 min-h-11 bg-action px-6 font-semibold text-action-fg"
          onPress={onCreate}
          radius="md"
          startContent={<Plus aria-hidden="true" size={18} />}
        >
          Ajouter mon premier moniteur
        </Button>
      </div>
      <ol className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon

          return (
            <li className="bg-canvas p-5" key={step.title}>
              <div className="flex items-center gap-2 text-action">
                <Icon aria-hidden="true" size={17} />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Étape {index + 1}
                </span>
              </div>
              <p className="mt-2 font-semibold">{step.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {step.description}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function DashboardPage() {
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all')
  const foldersQuery = useFolders()
  const activityQuery = useQuery({
    queryFn: getMonitorsActivity,
    queryKey: ['monitors-activity'],
    refetchInterval: 60_000,
  })
  const [query, setQuery] = useState('')
  const preferences = usePreferences()
  const [sortOverride, setSort] = useState<MonitorSort | null>(null)
  const [viewOverride, setView] = useState<DashboardView | null>(readStoredView)
  const sort = sortOverride ?? preferences.data?.dashboardSort ?? 'priority'
  const view = viewOverride ?? preferences.data?.dashboardView ?? 'list'
  const navigate = useNavigate()
  const nowMs = useNow()
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
    refetchInterval: previewState === null ? REFRESH_INTERVAL_MS : false,
    retry: previewState === 'error' ? false : 1,
  })

  const monitors = (monitorsQuery.data ?? []).map((monitor) =>
    withEffectiveStatus(monitor, nowMs),
  )
  const normalizedSearch = query.trim().toLowerCase()
  const visibleMonitors = sortMonitors(
    monitors.filter(
      (monitor) =>
        matchesFilter(monitor.status, filter) &&
        matchesFolder(monitor.folderId, folderFilter) &&
        (normalizedSearch.length === 0 ||
          monitor.localLabel.toLowerCase().includes(normalizedSearch) ||
          monitor.id.toLowerCase().includes(normalizedSearch)),
    ),
    sort,
  )
  const summary = summarizeMonitors(monitors)
  const folderCounts: Record<string, number> = {}

  for (const monitor of monitors) {
    const key = monitor.folderId ?? 'none'

    folderCounts[key] = (folderCounts[key] ?? 0) + 1
  }
  const goToCreate = () => void navigate({ to: '/monitors/new' })

  function changeView(next: DashboardView) {
    setView(next)
    storeView(next)
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Moniteurs</h1>
          <p className="mt-0.5 truncate text-sm text-muted">
            Centre de surveillance · heartbeats de vos tâches planifiées
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Actualiser la liste"
            className="min-h-9 min-w-9 border-line"
            isIconOnly
            isLoading={monitorsQuery.isFetching && !monitorsQuery.isPending}
            onPress={() => void monitorsQuery.refetch()}
            radius="md"
            size="sm"
            variant="bordered"
          >
            <RefreshCw aria-hidden="true" size={15} />
          </Button>
          <Button
            className="min-h-9 bg-action px-4 text-sm font-semibold text-action-fg"
            onPress={goToCreate}
            radius="md"
            size="sm"
          >
            <Plus aria-hidden="true" size={16} />
            Créer un moniteur
          </Button>
        </div>
      </header>

      <HealthBanner summary={summary} />

      <StatusSummary
        activeFilter={filter}
        onSelect={setFilter}
        summary={summary}
      />

      {monitors.length > 0 ? (
        <FolderBar
          activeFilter={folderFilter}
          counts={folderCounts}
          folders={foldersQuery.data ?? []}
          onSelect={setFolderFilter}
          total={monitors.length}
        />
      ) : null}

      <section aria-labelledby="monitor-list-title">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" id="monitor-list-title">
              Moniteurs
            </h2>
            <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-muted tabular-nums">
              {visibleMonitors.length}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                size={16}
              />
              <input
                aria-label="Rechercher un moniteur"
                className="min-h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted focus:border-action"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un moniteur…"
                type="search"
                value={query}
              />
            </div>
            <Select
              aria-label="Trier les moniteurs"
              className="sm:w-44"
              disallowEmptySelection
              onSelectionChange={(keys) => {
                const next = [...keys][0]
                const option = SORT_OPTIONS.find(([value]) => value === next)

                if (option) {
                  setSort(option[0])
                }
              }}
              radius="md"
              selectedKeys={[sort]}
              size="sm"
            >
              {SORT_OPTIONS.map(([value, label]) => (
                <SelectItem key={value}>{label}</SelectItem>
              ))}
            </Select>
            <div
              aria-label="Affichage"
              className="flex gap-1 rounded-lg border border-line bg-surface p-1"
              role="group"
            >
              {(
                [
                  ['list', 'Vue liste', List],
                  ['grid', 'Vue grille', LayoutGrid],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  aria-label={label}
                  aria-pressed={view === value}
                  className={`grid size-8 place-items-center rounded-md ${
                    view === value
                      ? 'bg-action-soft text-action'
                      : 'text-muted hover:text-ink'
                  }`}
                  key={value}
                  onClick={() => changeView(value)}
                  type="button"
                >
                  <Icon aria-hidden="true" size={16} />
                </button>
              ))}
            </div>
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
        ) : monitors.length === 0 ? (
          <OnboardingCard onCreate={goToCreate} />
        ) : visibleMonitors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
            <SearchX
              aria-hidden="true"
              className="mx-auto text-action"
              size={28}
            />
            <h3 className="mt-4 text-lg font-semibold">
              Aucun résultat pour ce filtre
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Modifiez la recherche ou revenez à tous les moniteurs.
            </p>
            <button
              className="mt-5 min-h-10 rounded-md px-3 text-sm font-medium text-action hover:bg-action-soft"
              onClick={() => {
                setQuery('')
                setFilter('all')
                setFolderFilter('all')
              }}
              type="button"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : view === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleMonitors.map((monitor, index) => (
              <MonitorListItem
                index={index}
                key={monitor.id}
                monitor={monitor}
                nowMs={nowMs}
                view="grid"
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <div
              aria-hidden="true"
              className="hidden border-b border-line bg-canvas/60 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-muted lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(10rem,1fr)_8.5rem_7.5rem_9.5rem_1rem] lg:gap-4"
            >
              <span>Moniteur</span>
              <span>Échéance</span>
              <span>Statut</span>
              <span>Activité 14 j</span>
              <span className="text-right">Dernier signal</span>
              <span />
            </div>
            {visibleMonitors.map((monitor, index) => (
              <MonitorListItem
                activity={activityQuery.data?.get(monitor.id)}
                index={index}
                key={monitor.id}
                monitor={monitor}
                nowMs={nowMs}
                view="list"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
