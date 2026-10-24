import { Button, Skeleton } from '@heroui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  CirclePause,
  CirclePlay,
  Clipboard,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

import { useCurrentAccount } from '../../accounts/query/use-current-account.ts'
import {
  deleteMonitor,
  getMonitor,
  listMonitorIncidents,
  pauseMonitor,
  resumeMonitor,
  rotateMonitorToken,
} from '../api/monitoring-api.ts'
import {
  formatDateTime,
  formatFrequency,
  formatRelativeTime,
  statusLabel,
} from '../model/monitor-format.ts'
import { StatusBadge } from './status-badge.tsx'

export function MonitorDetailPage({
  monitorId,
}: Readonly<{ monitorId: string }>) {
  const [copied, setCopied] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [rotatedToken, setRotatedToken] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const accountQuery = useCurrentAccount()
  const monitorQuery = useQuery({
    queryKey: ['monitors', monitorId],
    queryFn: () => getMonitor(monitorId),
  })
  const incidentsQuery = useQuery({
    queryKey: ['monitors', monitorId, 'incidents'],
    queryFn: () => listMonitorIncidents(monitorId),
  })
  const pause = useMutation({
    mutationFn: () => pauseMonitor(monitorId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['monitors'] })
    },
  })
  const resume = useMutation({
    mutationFn: () => resumeMonitor(monitorId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['monitors'] })
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteMonitor(monitorId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['monitors', monitorId] })
      await queryClient.invalidateQueries({ queryKey: ['monitors'] })
      await navigate({ replace: true, to: '/' })
    },
  })
  const rotate = useMutation({
    mutationFn: () => rotateMonitorToken(monitorId),
    onSuccess: (token) => {
      setCopiedToken(false)
      setRotatedToken(token)
    },
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

  async function copyToken() {
    if (!rotatedToken) {
      return
    }

    await navigator.clipboard.writeText(rotatedToken)
    setCopiedToken(true)
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
          <p className="mt-1 font-semibold">
            {formatDateTime(monitor.alertAtMs)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {formatRelativeTime(monitor.alertAtMs)}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        {monitor.status === 'paused' ? (
          <Button
            className="min-h-11 bg-action text-white"
            isLoading={resume.isPending}
            onPress={() => resume.mutate()}
            radius="md"
            startContent={<CirclePlay aria-hidden="true" size={17} />}
          >
            Reprendre la surveillance
          </Button>
        ) : (
          <Button
            className="min-h-11 border-line"
            isLoading={pause.isPending}
            onPress={() => pause.mutate()}
            radius="md"
            startContent={<CirclePause aria-hidden="true" size={17} />}
            variant="bordered"
          >
            Mettre en pause
          </Button>
        )}

        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-danger">
            <span className="text-sm">Supprimer définitivement ?</span>
            <Button
              className="min-h-10 bg-danger text-white"
              isLoading={remove.isPending}
              onPress={() => remove.mutate()}
              radius="md"
              size="sm"
            >
              Confirmer
            </Button>
            <Button
              className="min-h-10 border-danger-border text-danger"
              onPress={() => setConfirmDelete(false)}
              radius="md"
              size="sm"
              variant="bordered"
            >
              Annuler
            </Button>
          </div>
        ) : (
          <Button
            className="min-h-11 border-danger-border text-danger"
            onPress={() => setConfirmDelete(true)}
            radius="md"
            startContent={<Trash2 aria-hidden="true" size={17} />}
            variant="bordered"
          >
            Supprimer
          </Button>
        )}
      </div>

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
            <Button
              className="ml-3 mt-4 min-h-11 border-line"
              isLoading={rotate.isPending}
              onPress={() => rotate.mutate()}
              radius="md"
              startContent={<RefreshCw aria-hidden="true" size={17} />}
              variant="bordered"
            >
              Renouveler le token
            </Button>

            {rotatedToken ? (
              <div
                className="mt-5 rounded-lg border border-warning-border bg-warning-bg p-4 text-warning"
                role="status"
              >
                <p className="font-semibold">Nouveau token affiché une fois</p>
                <p className="mt-1 text-sm">
                  L’ancien token est maintenant invalide. Copiez ce secret dans
                  votre gestionnaire de secrets.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-surface px-3 py-2 font-mono text-xs text-ink">
                    {rotatedToken}
                  </code>
                  <Button
                    className="min-h-10 border-warning-border text-warning"
                    onPress={() => void copyToken()}
                    radius="md"
                    size="sm"
                    variant="bordered"
                  >
                    {copiedToken ? 'Token copié' : 'Copier le token'}
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Derniers incidents</h2>
            {incidentsQuery.isPending ? (
              <Skeleton className="mt-4 h-20 rounded-lg" />
            ) : (incidentsQuery.data ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Aucun incident récent pour ce moniteur.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {(incidentsQuery.data ?? []).map((incident) => (
                  <li
                    className="rounded-lg border border-line bg-canvas p-4"
                    key={incident.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Heartbeat manquant</p>
                      <p
                        className={`text-xs font-medium ${
                          incident.resolvedAtMs === null
                            ? 'text-warning'
                            : 'text-healthy'
                        }`}
                      >
                        {incident.resolvedAtMs === null ? 'En cours' : 'Résolu'}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Ouvert le {formatDateTime(incident.openedAtMs)}
                      {incident.resolvedAtMs !== null
                        ? ` · résolu le ${formatDateTime(incident.resolvedAtMs)}`
                        : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center gap-2 text-action">
              <Bell aria-hidden="true" size={17} />
              <h2 className="text-sm font-semibold">Alertes e-mail</h2>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">
              Les ouvertures et résolutions d’incident sont envoyées à l’adresse
              de votre compte :
            </p>
            <p className="mt-2 truncate text-sm font-medium">
              {accountQuery.data?.user.email ?? 'Compte connecté'}
            </p>
            <p className="mt-3 text-xs leading-5 text-muted">
              L’e-mail n’est pas stocké dans le moniteur. Il est résolu au
              moment de la livraison.
            </p>
          </section>

          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">Configuration</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Fréquence</dt>
                <dd className="font-medium">
                  {formatFrequency(monitor.intervalMinutes)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Marge</dt>
                <dd className="font-medium">{monitor.graceMinutes} min</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Créé le</dt>
                <dd className="font-medium">
                  {formatDateTime(monitor.createdAtMs)}
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
