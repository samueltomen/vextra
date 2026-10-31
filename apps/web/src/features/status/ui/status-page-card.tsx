import { Button, Input } from '@heroui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Globe } from 'lucide-react'
import { useState } from 'react'

import { ApiError } from '../../../api/client.ts'
import { listMonitors } from '../../monitoring/api/monitoring-api.ts'
import {
  getStatusPageSettings,
  saveStatusPage,
  type StatusPageSettingsView,
} from '../api/status-api.ts'

const QUERY_KEY = ['status-page'] as const

type Draft = Readonly<{
  description: string
  enabled: boolean
  monitorIds: readonly string[]
  slug: string
  title: string
}>

function toDraft(settings: StatusPageSettingsView): Draft {
  return {
    description: settings.page?.description ?? '',
    enabled: settings.page?.enabled ?? true,
    monitorIds: settings.monitorIds,
    slug: settings.page?.slug ?? '',
    title: settings.page?.title ?? '',
  }
}

function describeError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'slug_taken') {
    return 'Cette adresse est déjà utilisée. Choisissez-en une autre.'
  }

  if (error instanceof ApiError && error.code === 'validation_failed') {
    return 'Vérifiez l’adresse (3 à 40 lettres minuscules, chiffres ou tirets) et le titre.'
  }

  return 'La page de statut n’a pas pu être enregistrée. Réessayez.'
}

function BadgeSnippets({
  origin,
  slug,
}: Readonly<{ origin: string; slug: string }>) {
  const statusUrl = `${origin}/api/status/${slug}/badge.svg`
  const uptimeUrl = `${statusUrl}?metric=uptime`
  const pageUrl = `${origin}/status/${slug}`

  return (
    <div className="rounded-lg border border-line bg-canvas/40 p-3">
      <p className="text-sm font-medium">Badges pour votre README</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <img alt="Badge de statut" height={20} src={statusUrl} />
        <img alt="Badge de disponibilité" height={20} src={uptimeUrl} />
      </div>
      <p className="mt-3 text-xs text-muted">Markdown</p>
      <pre className="overflow-x-auto rounded bg-canvas p-2 font-mono text-xs">
        {`[![Statut](${statusUrl})](${pageUrl})\n[![Disponibilité](${uptimeUrl})](${pageUrl})`}
      </pre>
    </div>
  )
}

function StatusPageForm({
  settings,
}: Readonly<{ settings: StatusPageSettingsView }>) {
  const queryClient = useQueryClient()
  const monitorsQuery = useQuery({
    queryFn: listMonitors,
    queryKey: ['monitors', null],
  })
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings))
  const [saved, setSaved] = useState(false)
  const save = useMutation({
    mutationFn: () =>
      saveStatusPage({
        description: draft.description.trim() || null,
        enabled: draft.enabled,
        monitorIds: [...draft.monitorIds],
        slug: draft.slug.trim(),
        title: draft.title.trim(),
      }),
    onSuccess: async (next) => {
      queryClient.setQueryData(QUERY_KEY, next)
      setDraft(toDraft(next))
      setSaved(true)
    },
  })
  const change = (patch: Partial<Draft>) => {
    setSaved(false)
    setDraft((current) => ({ ...current, ...patch }))
  }
  const toggleMonitor = (id: string, selected: boolean) =>
    change({
      monitorIds: selected
        ? [...draft.monitorIds, id]
        : draft.monitorIds.filter((candidate) => candidate !== id),
    })
  const publicUrl = settings.page
    ? new URL(
        `/status/${settings.page.slug}`,
        window.location.origin,
      ).toString()
    : null

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          checked={draft.enabled}
          className="size-4 accent-[var(--cp-color-action)]"
          onChange={(event) => change({ enabled: event.target.checked })}
          type="checkbox"
        />
        Publier la page de statut
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="mb-1.5 block text-sm font-medium"
            htmlFor="status-title"
          >
            Titre
          </label>
          <Input
            id="status-title"
            onValueChange={(title) => change({ title })}
            placeholder="Statut de nos services"
            radius="md"
            value={draft.title}
          />
        </div>
        <div>
          <label
            className="mb-1.5 block text-sm font-medium"
            htmlFor="status-slug"
          >
            Adresse
          </label>
          <Input
            classNames={{ input: 'font-mono' }}
            id="status-slug"
            onValueChange={(slug) => change({ slug: slug.toLowerCase() })}
            placeholder="mon-entreprise"
            radius="md"
            value={draft.slug}
          />
        </div>
      </div>

      <div>
        <label
          className="mb-1.5 block text-sm font-medium"
          htmlFor="status-description"
        >
          Description (facultatif)
        </label>
        <Input
          id="status-description"
          onValueChange={(description) => change({ description })}
          radius="md"
          value={draft.description}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Moniteurs affichés publiquement
        </legend>
        {monitorsQuery.data && monitorsQuery.data.length > 0 ? (
          <ul className="space-y-1.5">
            {monitorsQuery.data.map((monitor) => (
              <li key={monitor.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    checked={draft.monitorIds.includes(monitor.id)}
                    className="size-4 accent-[var(--cp-color-action)]"
                    onChange={(event) =>
                      toggleMonitor(monitor.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  {monitor.localLabel}
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Aucun moniteur disponible.</p>
        )}
        <p className="mt-2 text-xs leading-5 text-muted">
          Seuls le nom, l’état et la disponibilité sont publics ; jamais les
          jetons, les notes ni la planification.
        </p>
      </fieldset>

      {save.isError ? (
        <p
          className="rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger"
          role="alert"
        >
          {describeError(save.error)}
        </p>
      ) : null}
      {saved && publicUrl ? (
        <p className="text-sm text-healthy" role="status">
          Enregistré.{' '}
          {settings.page?.enabled ? (
            <a
              className="underline"
              href={publicUrl}
              rel="noreferrer"
              target="_blank"
            >
              Ouvrir la page publique
            </a>
          ) : (
            'La page n’est pas encore publiée.'
          )}
        </p>
      ) : null}

      {settings.page?.enabled && publicUrl ? (
        <BadgeSnippets
          origin={window.location.origin}
          slug={settings.page.slug}
        />
      ) : null}

      <Button
        className="min-h-10 bg-action font-semibold text-action-fg"
        isDisabled={
          draft.title.trim().length === 0 || draft.slug.trim().length < 3
        }
        isLoading={save.isPending}
        radius="md"
        type="submit"
      >
        Enregistrer la page de statut
      </Button>
    </form>
  )
}

export function StatusPageCard() {
  const query = useQuery({
    queryFn: getStatusPageSettings,
    queryKey: QUERY_KEY,
  })

  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2 text-action">
        <Globe aria-hidden="true" size={18} />
        <h2 className="text-sm font-semibold">Page de statut publique</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">
        Partagez l’état de vos services avec vos clients, sans compte.
      </p>
      {query.isPending ? (
        <p className="mt-4 text-sm text-muted" role="status">
          Chargement…
        </p>
      ) : query.isError ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          Impossible de charger la page de statut.
        </p>
      ) : (
        <StatusPageForm settings={query.data} />
      )}
    </section>
  )
}
