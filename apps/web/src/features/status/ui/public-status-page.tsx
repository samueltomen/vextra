import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { CheckCircle2, CircleAlert, CircleHelp } from 'lucide-react'

import { BrandMark } from '../../../components/brand-mark.tsx'
import { getPublicStatusPage } from '../api/status-api.ts'
import {
  formatUptime,
  summarizeOverallStatus,
} from '../model/status-summary.ts'

const REFRESH_MS = 30_000

const STATUS_LABEL = {
  healthy: 'Opérationnel',
  late: 'Incident en cours',
  paused: 'En maintenance',
  pending: 'En attente',
} as const

const STATUS_DOT = {
  healthy: 'bg-healthy-solid',
  late: 'bg-danger',
  paused: 'bg-muted',
  pending: 'bg-muted',
} as const

const BANNER = {
  degraded: {
    className: 'border-danger-border bg-danger-bg text-danger',
    icon: CircleAlert,
    label: 'Certains services rencontrent un incident',
  },
  operational: {
    className: 'border-healthy-border bg-healthy-bg text-healthy',
    icon: CheckCircle2,
    label: 'Tous les services sont opérationnels',
  },
  unknown: {
    className: 'border-line bg-surface text-muted',
    icon: CircleHelp,
    label: 'Aucun service actif à afficher',
  },
} as const

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function PublicStatusPage() {
  const { slug } = useParams({ from: '/status/$slug' })
  const query = useQuery({
    queryFn: () => getPublicStatusPage(slug),
    queryKey: ['public-status', slug],
    refetchInterval: REFRESH_MS,
  })

  if (query.isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas text-muted">
        <p role="status">Chargement…</p>
      </main>
    )
  }

  if (query.isError) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4">
        <p className="text-danger" role="alert">
          La page de statut est momentanément indisponible.
        </p>
      </main>
    )
  }

  const page = query.data

  if (page === null) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-4 text-center">
        <div>
          <h1 className="text-xl font-semibold">Page de statut introuvable</h1>
          <p className="mt-2 text-muted">
            Cette adresse n’existe pas ou n’est pas publiée.
          </p>
        </div>
      </main>
    )
  }

  const banner = BANNER[summarizeOverallStatus(page)]
  const BannerIcon = banner.icon

  return (
    <main className="min-h-dvh bg-canvas px-4 py-10 text-ink">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex items-center gap-3">
          <BrandMark size="sm" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {page.title}
            </h1>
            {page.description ? (
              <p className="text-sm text-muted">{page.description}</p>
            ) : null}
          </div>
        </header>

        <div
          className={`flex items-center gap-3 rounded-xl border p-4 font-medium ${banner.className}`}
          role="status"
        >
          <BannerIcon aria-hidden="true" size={20} />
          {banner.label}
        </div>

        <section aria-labelledby="services-title">
          <h2 className="mb-3 text-sm font-semibold" id="services-title">
            Services
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {page.monitors.map((monitor, index) => (
              <li
                className="flex items-center justify-between gap-4 p-4"
                key={`${monitor.name}-${index}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[monitor.status]}`}
                  />
                  <span className="truncate font-medium">{monitor.name}</span>
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="block">{STATUS_LABEL[monitor.status]}</span>
                  <span className="font-mono text-xs text-muted">
                    {formatUptime(monitor.uptime30d)} sur 30 jours
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="incidents-title">
          <h2 className="mb-3 text-sm font-semibold" id="incidents-title">
            Incidents des 14 derniers jours
          </h2>
          {page.incidents.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
              Aucun incident récent.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {page.incidents.map((incident, index) => (
                <li
                  className="p-4 text-sm"
                  key={`${incident.openedAt}-${index}`}
                >
                  <p className="font-medium">{incident.monitor}</p>
                  <p className="mt-1 text-muted">
                    {formatWhen(incident.openedAt)} —{' '}
                    {incident.resolvedAt
                      ? `résolu le ${formatWhen(incident.resolvedAt)}`
                      : 'en cours'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="text-center text-xs text-muted">
          Mis à jour automatiquement · Propulsé par Vextra
        </footer>
      </div>
    </main>
  )
}
