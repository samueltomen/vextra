import { Button, Input, Skeleton } from '@heroui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  CirclePause,
  CirclePlay,
  Gauge,
  KeyRound,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Timer,
  Trash2,
  TriangleAlert,
  Wifi,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { CodeTabs } from '../../../components/code-tabs.tsx'
import { useNow } from '../../../lib/use-now.ts'
import { useCurrentAccount } from '../../accounts/query/use-current-account.ts'
import {
  deleteMonitor,
  getMonitor,
  listMonitorIncidents,
  pauseMonitor,
  renameMonitor,
  updateMonitorSchedule,
  type MonitorScheduleDraft,
  resumeMonitor,
  rotateMonitorToken,
  type MonitorIncidentView,
} from '../api/monitoring-api.ts'
import {
  computeAvailability,
  formatDuration,
  formatUptime,
} from '../model/availability.ts'
import { buildIntegrationSnippets } from '../model/integration-snippets.ts'
import {
  formatDateTime,
  formatFrequency,
  formatRelativeTime,
  statusLabel,
} from '../model/monitor-format.ts'
import { AvailabilityBar } from './availability-bar.tsx'
import { DurationPicker } from './duration-picker.tsx'
import {
  GRACE_PRESETS,
  INTERVAL_PRESETS,
  validateGrace,
  validateInterval,
} from './schedule-presets.ts'
import { StatusBadge } from './status-badge.tsx'

const REFRESH_INTERVAL_MS = 30_000

function StatCard({
  detail,
  icon,
  label,
  value,
}: Readonly<{
  detail: string
  icon: ReactNode
  label: string
  value: string
}>) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <p className="text-xs font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  )
}

function resolutionLabel(incident: MonitorIncidentView): string {
  if (incident.resolvedAtMs === null) {
    return 'En cours'
  }

  return incident.resolutionReason === 'manual'
    ? 'Clos par une pause'
    : 'Résolu'
}

export function MonitorDetailPage({
  monitorId,
}: Readonly<{ monitorId: string }>) {
  const [copiedToken, setCopiedToken] = useState(false)
  const [rotatedToken, setRotatedToken] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [scheduleDraft, setScheduleDraft] =
    useState<MonitorScheduleDraft | null>(null)
  const [labelDraft, setLabelDraft] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const nowMs = useNow()
  const accountQuery = useCurrentAccount()
  const monitorQuery = useQuery({
    queryKey: ['monitors', monitorId],
    queryFn: () => getMonitor(monitorId),
    refetchInterval: REFRESH_INTERVAL_MS,
  })
  const incidentsQuery = useQuery({
    queryKey: ['monitors', monitorId, 'incidents'],
    queryFn: () => listMonitorIncidents(monitorId),
    refetchInterval: REFRESH_INTERVAL_MS,
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
  const saveSchedule = useMutation({
    mutationFn: (draft: MonitorScheduleDraft) =>
      updateMonitorSchedule(monitorId, draft),
    onSuccess: async () => {
      setScheduleDraft(null)
      await queryClient.invalidateQueries({ queryKey: ['monitors'] })
    },
  })
  const rename = useMutation({
    mutationFn: (label: string) => renameMonitor(monitorId, label),
    onSuccess: async () => {
      setRenaming(false)
      await queryClient.invalidateQueries({ queryKey: ['monitors'] })
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
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
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
          className="mt-6 min-h-11 bg-action text-action-fg"
          onPress={() => void navigate({ to: '/' })}
          radius="md"
        >
          Retour au dashboard
        </Button>
      </div>
    )
  }

  const incidents = incidentsQuery.data ?? []
  const availability = computeAvailability({
    createdAtMs: monitor.createdAtMs,
    incidents,
    nowMs,
  })
  const pingUrl = new URL('/api/ping', window.location.origin).toString()
  const snippets = buildIntegrationSnippets({
    intervalMinutes: monitor.intervalMinutes,
    pingUrl,
    token: rotatedToken,
  })

  async function copyToken() {
    if (!rotatedToken) {
      return
    }

    await navigator.clipboard.writeText(rotatedToken)
    setCopiedToken(true)
  }

  const scheduleError = scheduleDraft
    ? (validateInterval(scheduleDraft.intervalMinutes) ??
      validateGrace(scheduleDraft.graceMinutes))
    : undefined
  const scheduleChanged =
    scheduleDraft !== null &&
    (scheduleDraft.intervalMinutes !== monitor.intervalMinutes ||
      scheduleDraft.graceMinutes !== monitor.graceMinutes)

  function startRenaming() {
    setLabelDraft(monitor?.localLabel ?? '')
    setRenaming(true)
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

      <header className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {renaming ? (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (labelDraft.trim().length > 0) {
                    rename.mutate(labelDraft)
                  }
                }}
              >
                <Input
                  aria-label="Libellé local"
                  autoFocus
                  className="w-72 max-w-full"
                  onValueChange={setLabelDraft}
                  radius="md"
                  value={labelDraft}
                />
                <Button
                  className="min-h-10 bg-action text-action-fg"
                  isDisabled={labelDraft.trim().length === 0}
                  isLoading={rename.isPending}
                  radius="md"
                  type="submit"
                >
                  Enregistrer
                </Button>
                <Button
                  className="min-h-10 border-line"
                  onPress={() => setRenaming(false)}
                  radius="md"
                  variant="bordered"
                >
                  Annuler
                </Button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {monitor.localLabel}
                </h1>
                <StatusBadge status={monitor.status} />
                <button
                  aria-label="Renommer le moniteur"
                  className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
                  onClick={startRenaming}
                  type="button"
                >
                  <Pencil aria-hidden="true" size={16} />
                </button>
              </div>
            )}
            <p className="mt-2 font-mono text-xs text-muted">
              {monitor.id.slice(0, 8)} · libellé local uniquement
            </p>
          </div>
          <div className="text-sm lg:text-right">
            <p className="text-muted">Prochaine échéance</p>
            <p className="mt-1 font-semibold">
              {formatDateTime(monitor.alertAtMs)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatRelativeTime(monitor.alertAtMs)}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-5">
          {monitor.status === 'paused' ? (
            <Button
              className="min-h-11 bg-action text-action-fg"
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
        </div>
      </header>

      {monitor.status === 'late' ? (
        <div
          className="flex gap-3 rounded-2xl border border-warning-border bg-warning-bg p-4 text-warning"
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

      <section
        aria-label="Indicateurs sur 30 jours"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard
          detail="sur les 30 derniers jours"
          icon={<Gauge aria-hidden="true" size={15} />}
          label="Disponibilité"
          value={formatUptime(availability.uptimePercent)}
        />
        <StatCard
          detail="ouverts sur 30 jours"
          icon={<TriangleAlert aria-hidden="true" size={15} />}
          label="Incidents"
          value={String(availability.incidentCount)}
        />
        <StatCard
          detail="durée moyenne d’un incident"
          icon={<Timer aria-hidden="true" size={15} />}
          label="Rétablissement"
          value={
            availability.mttrMs === null
              ? '—'
              : formatDuration(availability.mttrMs)
          }
        />
        <StatCard
          detail={formatDateTime(monitor.lastHeartbeatAtMs)}
          icon={<Wifi aria-hidden="true" size={15} />}
          label="Dernier signal"
          value={formatRelativeTime(monitor.lastHeartbeatAtMs)}
        />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">
          Historique de disponibilité
        </h2>
        <AvailabilityBar days={availability.days} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="flex items-center gap-2">
              <KeyRound aria-hidden="true" className="text-action" size={18} />
              <h2 className="text-lg font-semibold">Heartbeat</h2>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              Ajoutez cet appel à la fin du script. Le token est chargé depuis
              votre gestionnaire de secrets.
            </p>
            <div className="mt-4">
              <CodeTabs snippets={snippets} />
            </div>
            <Button
              className="mt-3 min-h-11 border-line"
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

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
            <h2 className="text-lg font-semibold">Derniers incidents</h2>
            {incidentsQuery.isPending ? (
              <Skeleton className="mt-4 h-20 rounded-lg" />
            ) : incidents.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Aucun incident récent pour ce moniteur.
              </p>
            ) : (
              <ol className="mt-5 space-y-5 border-l border-line pl-6">
                {incidents.map((incident) => {
                  const open = incident.resolvedAtMs === null

                  return (
                    <li className="relative" key={incident.id}>
                      <span
                        aria-hidden="true"
                        className={`absolute -left-[31px] top-1 size-3 rounded-full ring-4 ring-surface ${
                          open ? 'bg-warning-solid' : 'bg-healthy-solid'
                        }`}
                      />
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          Heartbeat manquant
                        </p>
                        <p
                          className={`text-xs font-medium ${
                            open ? 'text-warning' : 'text-healthy'
                          }`}
                        >
                          {resolutionLabel(incident)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Ouvert le {formatDateTime(incident.openedAtMs)}
                        {incident.resolvedAtMs !== null
                          ? ` · résolu le ${formatDateTime(incident.resolvedAtMs)}`
                          : ''}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Durée :{' '}
                        {formatDuration(
                          (incident.resolvedAtMs ?? nowMs) -
                            incident.openedAtMs,
                        )}
                      </p>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
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

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Configuration</h2>
              {scheduleDraft === null ? (
                <Button
                  className="min-h-9 border-line"
                  onPress={() =>
                    setScheduleDraft({
                      graceMinutes: monitor.graceMinutes,
                      intervalMinutes: monitor.intervalMinutes,
                    })
                  }
                  radius="md"
                  size="sm"
                  startContent={<Pencil aria-hidden="true" size={14} />}
                  variant="bordered"
                >
                  Modifier la planification
                </Button>
              ) : null}
            </div>
            {scheduleDraft !== null ? (
              <form
                className="mt-4 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!scheduleError && scheduleChanged) {
                    saveSchedule.mutate(scheduleDraft)
                  }
                }}
              >
                <DurationPicker
                  description="Le rythme auquel votre tâche doit envoyer un signal."
                  error={validateInterval(scheduleDraft.intervalMinutes)}
                  label="Fréquence attendue"
                  onChange={(intervalMinutes) =>
                    setScheduleDraft({ ...scheduleDraft, intervalMinutes })
                  }
                  presets={INTERVAL_PRESETS}
                  value={scheduleDraft.intervalMinutes}
                />
                <DurationPicker
                  description="Temps accordé avant l’alerte."
                  error={validateGrace(scheduleDraft.graceMinutes)}
                  label="Marge"
                  onChange={(graceMinutes) =>
                    setScheduleDraft({ ...scheduleDraft, graceMinutes })
                  }
                  presets={GRACE_PRESETS}
                  value={scheduleDraft.graceMinutes}
                />
                <p className="rounded-lg bg-canvas p-3 text-xs leading-5 text-muted">
                  {monitor.status === 'paused'
                    ? 'Le moniteur est en pause : la nouvelle échéance sera calculée à la reprise.'
                    : monitor.status === 'late'
                      ? 'L’incident en cours conserve son échéance ; la nouvelle planification s’applique au prochain signal.'
                      : 'Une nouvelle échéance est calculée à partir de maintenant.'}
                </p>
                {saveSchedule.isError ? (
                  <p
                    className="rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger"
                    role="alert"
                  >
                    La planification n’a pas pu être enregistrée. Réessayez.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="min-h-10 bg-action font-semibold text-action-fg"
                    isDisabled={Boolean(scheduleError) || !scheduleChanged}
                    isLoading={saveSchedule.isPending}
                    radius="md"
                    type="submit"
                  >
                    Enregistrer la planification
                  </Button>
                  <Button
                    className="min-h-10 border-line"
                    onPress={() => {
                      saveSchedule.reset()
                      setScheduleDraft(null)
                    }}
                    radius="md"
                    variant="bordered"
                  >
                    Annuler la modification
                  </Button>
                </div>
              </form>
            ) : null}
            <dl className="mt-4 space-y-4 text-sm">
              {scheduleDraft === null ? (
                <>
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
                    <dt className="text-muted">Alerte après</dt>
                    <dd className="font-medium">
                      {formatDuration(
                        (monitor.intervalMinutes + monitor.graceMinutes) *
                          60_000,
                      )}
                    </dd>
                  </div>
                </>
              ) : null}
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

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2 text-healthy">
              <ShieldCheck aria-hidden="true" size={17} />
              <h2 className="text-sm font-semibold">Confidentialité</h2>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">
              Aucun contenu de script, sortie, IP ou commande cron n&apos;est
              conservé. Seul l&apos;état du heartbeat est enregistré.
            </p>
          </section>

          <section className="rounded-2xl border border-danger-border bg-surface p-5 shadow-card">
            <h2 className="text-sm font-semibold text-danger">
              Zone de danger
            </h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              La suppression est définitive : le token cesse de fonctionner et
              l’historique des incidents est effacé.
            </p>
            {confirmDelete ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-danger">
                <span className="text-sm">Supprimer définitivement ?</span>
                <Button
                  className="min-h-10 bg-danger text-white dark:text-[#2d1010]"
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
                className="mt-4 min-h-11 w-full border-danger-border text-danger"
                onPress={() => setConfirmDelete(true)}
                radius="md"
                startContent={<Trash2 aria-hidden="true" size={17} />}
                variant="bordered"
              >
                Supprimer
              </Button>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
