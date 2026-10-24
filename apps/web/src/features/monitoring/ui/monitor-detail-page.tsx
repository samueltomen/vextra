import { Button, Skeleton } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarClock,
  Clipboard,
  KeyRound,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'

import { getMonitor } from '../api/monitoring-api.ts'
import { formatRelativeTime, statusLabel } from '../model/monitor-format.ts'
import { StatusBadge } from './status-badge.tsx'

function formatDate(timestampMs: number | null): string {
  if (timestampMs === null) {
    return 'Aucun heartbeat reçu'
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestampMs)
}

export function MonitorDetailPage({
  monitorId,
}: Readonly<{ monitorId: string }>) {
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()
  const monitorQuery = useQuery({
    queryKey: ['monitors', monitorId],
    queryFn: () => getMonitor(monitorId),
  })

  if (monitorQuery.isPending) {
    return (
      <div
        aria-label="Chargement du moniteur"
        className="space-y-5"
        role="status"
      >
        <Skeleton className="h-5 w-32 rounded-md" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const monitor = monitorQuery.data

  if (!monitor) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-line bg-surface p-8 text-center">
        <ShieldCheck
          aria-hidden="true"
          className="mx-auto text-muted"
          size={30}
        />
        <h1 className="mt-4 text-2xl font-semibold">Moniteur introuvable</h1>
        <p className="mt-2 text-muted">
          Il a peut-être été supprimé ou n&apos;appartient pas à cet espace.
        </p>
        <Button
          className="mt-6 min-h-11 bg-action text-white"
          onPress={() => void navigate({ to: '/' })}
          radius="md"
        >
          Retour au dashboard
        </Button>
      </div>
    )
  }

  const pingUrl = new URL('/api/ping', window.location.origin).toString()
  const command = `curl --fail --silent --show-error --retry 3 \\
  --request POST \\
  --header "Authorization: Bearer $CRONPING_TOKEN" \\
  "${pingUrl}"`

  async function copyCommand() {
    await navigator.clipboard.writeText(command)
    setCopied(true)
  }

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted hover:text-ink"
        to="/"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        Tous les moniteurs
      </Link>

      <header className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {monitor.localLabel}
            </h1>
            <StatusBadge status={monitor.status} />
          </div>
          <p className="mt-2 font-mono text-xs text-muted">
            {monitor.id.slice(0, 8)} · libellé local uniquement
          </p>
        </div>
        <div className="text-sm sm:text-right">
          <p className="text-muted">Prochaine échéance</p>
          <p className="mt-1 font-semibold">{formatDate(monitor.alertAtMs)}</p>
          <p className="mt-1 text-xs text-muted">
            {formatRelativeTime(monitor.alertAtMs)}
          </p>
        </div>
      </header>

      {monitor.status === 'late' ? (
        <div
          className="flex gap-3 rounded-xl border border-warning-border bg-warning-bg p-4 text-warning"
          role="alert"
        >
          <CalendarClock
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            size={19}
          />
          <div>
            <p className="font-semibold">Heartbeat attendu mais non reçu</p>
            <p className="mt-1 text-sm">
              L&apos;échéance est dépassée de{' '}
              {formatRelativeTime(monitor.alertAtMs)}. Le moniteur reste en
              retard jusqu&apos;au prochain signal.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <KeyRound aria-hidden="true" className="text-action" size={18} />
              <h2 className="text-lg font-semibold">Heartbeat</h2>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              Ajoutez cette commande à la fin du script. Le token est chargé
              depuis votre gestionnaire de secrets.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-canvas p-4 font-mono text-sm leading-6">
              <code>{command}</code>
            </pre>
            <Button
              className="mt-4 min-h-11 bg-action text-white"
              onPress={() => void copyCommand()}
              radius="md"
            >
              <Clipboard aria-hidden="true" size={17} />
              {copied ? 'Commande copiée' : 'Copier la commande'}
            </Button>
          </section>

          <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Derniers incidents</h2>
            {monitor.status === 'late' ? (
              <div className="mt-4 border-l-2 border-warning-border pl-4">
                <p className="font-medium">Incident ouvert</p>
                <p className="mt-1 text-sm text-muted">
                  Aucun heartbeat reçu après l&apos;échéance du{' '}
                  {formatDate(monitor.alertAtMs)}.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Aucun incident récent pour ce moniteur.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">Configuration</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Fréquence</dt>
                <dd className="font-medium">
                  {monitor.intervalMinutes >= 1_440
                    ? `${monitor.intervalMinutes / 1_440} j`
                    : `${monitor.intervalMinutes} min`}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Marge</dt>
                <dd className="font-medium">{monitor.graceMinutes} min</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Créé le</dt>
                <dd className="font-medium">
                  {formatDate(monitor.createdAtMs)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Statut</dt>
                <dd className="font-medium">{statusLabel(monitor.status)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center gap-2 text-healthy">
              <ShieldCheck aria-hidden="true" size={17} />
              <h2 className="text-sm font-semibold">Confidentialité</h2>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">
              Aucun contenu de script, sortie, IP ou commande cron n&apos;est
              conservé. Seul l&apos;état du heartbeat est enregistré.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
