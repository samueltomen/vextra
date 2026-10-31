import { Button, Skeleton } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Mail, RefreshCw, Send } from 'lucide-react'

import { useCurrentAccount } from '../../accounts/query/use-current-account.ts'
import {
  formatDateTime,
  formatRelativeTime,
} from '../../monitoring/model/monitor-format.ts'
import { getLocalMonitorLabels } from '../../monitoring/model/local-labels.ts'
import {
  listNotifications,
  type NotificationDeliveryView,
} from '../api/notifications-api.ts'

const STATUS_CONFIG = {
  pending: {
    className: 'border-neutral-border bg-neutral-bg text-neutral',
    label: 'En attente',
  },
  processing: {
    className: 'border-action/20 bg-action-soft text-action',
    label: 'En cours',
  },
  sent: {
    className: 'border-healthy-border bg-healthy-bg text-healthy',
    label: 'Envoyé',
  },
  failed: {
    className: 'border-warning-border bg-warning-bg text-warning',
    label: 'Nouvelle tentative',
  },
  dead: {
    className: 'border-danger-border bg-danger-bg text-danger',
    label: 'Échec définitif',
  },
  skipped: {
    className: 'border-neutral-border bg-neutral-bg text-neutral',
    label: 'Ignoré (préférences)',
  },
} as const

function DeliveryRow({
  delivery,
  localLabel,
}: Readonly<{
  delivery: NotificationDeliveryView
  localLabel: string
}>) {
  const status = STATUS_CONFIG[delivery.status]

  return (
    <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5">
      <div className="min-w-0">
        <p className="truncate font-semibold">{localLabel}</p>
        <p className="mt-1 text-sm text-muted">
          {delivery.kind === 'incident_opened'
            ? 'Incident ouvert'
            : delivery.kind === 'run_failed'
              ? 'Exécution en échec'
              : 'Incident résolu'}
        </p>
        <p className="mt-1 font-mono text-xs text-muted">
          {delivery.monitorId.slice(0, 8)}
        </p>
      </div>
      <span
        className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
      >
        {status.label}
      </span>
      <div className="text-sm text-muted sm:text-right">
        <p className="tabular-nums">
          {formatRelativeTime(delivery.createdAtMs)}
        </p>
        <p className="mt-1 text-xs tabular-nums">
          {formatDateTime(delivery.createdAtMs)}
        </p>
      </div>
    </div>
  )
}

export function NotificationsPage() {
  const accountQuery = useCurrentAccount()
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: listNotifications,
  })
  const deliveries = notificationsQuery.data ?? []
  const sent = deliveries.filter(
    (delivery) => delivery.status === 'sent',
  ).length
  const failed = deliveries.filter(
    (delivery) => delivery.status === 'failed' || delivery.status === 'dead',
  ).length
  const labels = getLocalMonitorLabels()

  return (
    <div className="space-y-8">
      <header>
        <p className="mb-2 text-sm font-medium text-action">
          Canal e-mail uniquement
        </p>
        <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-3 max-w-2xl text-muted">
          CronPing alerte l’adresse de votre compte lorsqu’un incident s’ouvre
          ou se résout.
        </p>
      </header>

      <section
        aria-label="Configuration e-mail"
        className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_repeat(2,minmax(10rem,0.35fr))]"
      >
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2 text-action">
            <Mail aria-hidden="true" size={18} />
            <h2 className="text-sm font-semibold">Destinataire</h2>
          </div>
          <p className="mt-3 truncate text-lg font-semibold">
            {accountQuery.data?.user.email ?? 'Compte connecté'}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            L’adresse est résolue au moment de l’envoi. Elle n’est pas stockée
            dans les moniteurs.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">Livrés</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
            {sent}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-sm text-muted">À surveiller</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
            {failed}
          </p>
        </div>
      </section>

      <section aria-labelledby="delivery-history-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold" id="delivery-history-title">
            Historique des envois
          </h2>
          <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-muted tabular-nums">
            {deliveries.length}
          </span>
        </div>

        {notificationsQuery.isPending ? (
          <div aria-label="Chargement des notifications" role="status">
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : notificationsQuery.isError ? (
          <div className="rounded-xl border border-danger-border bg-danger-bg p-5 text-danger">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle aria-hidden="true" size={18} />
              Impossible de charger les notifications.
            </div>
            <Button
              className="mt-4 border-danger-border text-danger"
              onPress={() => void notificationsQuery.refetch()}
              radius="md"
              startContent={<RefreshCw aria-hidden="true" size={16} />}
              variant="bordered"
            >
              Réessayer
            </Button>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
            <Send
              aria-hidden="true"
              className="mx-auto text-action"
              size={28}
            />
            <h3 className="mt-4 text-lg font-semibold">Aucun e-mail envoyé</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Les prochains incidents et retours à la normale apparaîtront ici.
            </p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {deliveries.map((delivery, index) => (
              <li
                className={index > 0 ? 'border-t border-line' : undefined}
                key={delivery.id}
              >
                <DeliveryRow
                  delivery={delivery}
                  localLabel={
                    labels[delivery.monitorId] ??
                    `Moniteur ${delivery.monitorId.slice(0, 8)}`
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
