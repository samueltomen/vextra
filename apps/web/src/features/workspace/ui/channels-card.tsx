import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plug, Send, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ApiError } from '../../../api/client.ts'
import {
  createChannel,
  deleteChannel,
  listChannels,
  setChannelEnabled,
  testChannel,
  type ChannelKind,
  type ChannelView,
} from '../api/workspace-api.ts'

const CHANNELS_QUERY_KEY = ['channels'] as const

const KINDS: Readonly<
  Record<
    ChannelKind,
    Readonly<{ field: string; label: string; placeholder: string }>
  >
> = {
  discord: {
    field: 'URL du webhook Discord',
    label: 'Discord',
    placeholder: 'https://discord.com/api/webhooks/…',
  },
  pagerduty: {
    field: 'Clé d’intégration (32 caractères)',
    label: 'PagerDuty',
    placeholder: 'Clé Events API v2',
  },
  slack: {
    field: 'URL du webhook entrant Slack',
    label: 'Slack',
    placeholder: 'https://hooks.slack.com/services/…',
  },
  teams: {
    field: 'URL du webhook Teams (Workflows)',
    label: 'Microsoft Teams',
    placeholder: 'https://…logic.azure.com/…',
  },
  telegram: {
    field: 'Jeton du bot | identifiant du chat',
    label: 'Telegram',
    placeholder: '123456:ABC-DEF…|-1001234567',
  },
  webhook: {
    field: 'URL HTTPS de votre endpoint',
    label: 'Webhook générique',
    placeholder: 'https://exemple.com/hooks/vextra',
  },
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'channel_name_taken') {
      return 'Ce nom de canal est déjà utilisé.'
    }

    if (error.code === 'channel_limit_reached') {
      return 'Limite de 10 canaux atteinte.'
    }

    if (error.code === 'invalid_channel_target') {
      return 'Cette destination n’est pas valide pour ce type de canal.'
    }

    if (error.code === 'channel_test_failed') {
      return 'Le canal n’a pas accepté le message de test.'
    }
  }

  return 'L’opération a échoué. Réessayez.'
}

function ChannelRow({ channel }: Readonly<{ channel: ChannelView }>) {
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'ok'
    text: string
  } | null>(null)
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY })
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setChannelEnabled(channel.id, enabled),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: () => deleteChannel(channel.id),
    onSuccess: refresh,
  })
  const test = useMutation({
    mutationFn: () => testChannel(channel.id),
    onError: (error) =>
      setFeedback({ kind: 'error', text: describeError(error) }),
    onSuccess: () =>
      setFeedback({ kind: 'ok', text: 'Message de test envoyé.' }),
  })

  return (
    <li className="rounded-lg border border-line bg-canvas/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{channel.name}</p>
          <p className="font-mono text-xs text-muted">
            {KINDS[channel.kind].label} · {channel.targetHint}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            aria-label={`Activer le canal ${channel.name}`}
            checked={channel.enabled}
            className="size-4 accent-[var(--cp-color-action)]"
            disabled={toggle.isPending}
            onChange={(event) => toggle.mutate(event.target.checked)}
            type="checkbox"
          />
          Activé
        </label>
        <button
          aria-label={`Envoyer un test au canal ${channel.name}`}
          className="flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm hover:border-border-strong disabled:opacity-60"
          disabled={test.isPending}
          onClick={() => {
            setFeedback(null)
            test.mutate()
          }}
          type="button"
        >
          <Send aria-hidden="true" size={14} />
          Tester
        </button>
        <button
          aria-label={`Supprimer le canal ${channel.name}`}
          className="grid size-9 place-items-center rounded-md border border-line text-muted hover:border-danger-border hover:text-danger"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
          type="button"
        >
          <Trash2 aria-hidden="true" size={15} />
        </button>
      </div>
      {feedback ? (
        <p
          className={`mt-2 text-xs ${
            feedback.kind === 'ok' ? 'text-healthy' : 'text-danger'
          }`}
          role={feedback.kind === 'ok' ? 'status' : 'alert'}
        >
          {feedback.text}
        </p>
      ) : null}
    </li>
  )
}

export function ChannelsCard() {
  const queryClient = useQueryClient()
  const channels = useQuery({
    queryFn: listChannels,
    queryKey: CHANNELS_QUERY_KEY,
  })
  const [kind, setKind] = useState<ChannelKind>('slack')
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: () => createChannel({ kind, name: name.trim(), target }),
    onError: (cause) => setError(describeError(cause)),
    onSuccess: async () => {
      setName('')
      setTarget('')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY })
    },
  })
  const config = KINDS[kind]

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <section
      aria-labelledby="channels-title"
      className="rounded-xl border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 text-action">
        <Plug aria-hidden="true" size={18} />
        <h2 className="text-sm font-semibold" id="channels-title">
          Canaux d’alerte
        </h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        En plus de l’e-mail, envoyez les alertes vers Slack, Discord, Telegram,
        Teams, PagerDuty ou un webhook. La destination est un secret : elle
        n’est jamais renvoyée après l’enregistrement.
      </p>

      {channels.isPending ? (
        <p className="mt-4 text-sm text-muted" role="status">
          Chargement des canaux…
        </p>
      ) : channels.isError ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          Impossible de charger les canaux.
        </p>
      ) : channels.data.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Aucun canal configuré.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {channels.data.map((channel) => (
            <ChannelRow channel={channel} key={channel.id} />
          ))}
        </ul>
      )}

      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Type de canal</span>
          <select
            className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none focus:border-action"
            onChange={(event) => {
              setKind(event.target.value as ChannelKind)
              setTarget('')
            }}
            value={kind}
          >
            {(Object.keys(KINDS) as ChannelKind[]).map((value) => (
              <option key={value} value={value}>
                {KINDS[value].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Nom du canal</span>
          <input
            className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-action"
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex. Équipe ops"
            value={name}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1.5 block font-medium">{config.field}</span>
          <input
            autoComplete="off"
            className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 font-mono text-xs outline-none placeholder:text-muted focus:border-action"
            maxLength={600}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={config.placeholder}
            type="password"
            value={target}
          />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            className="min-h-10 rounded-md bg-action px-4 text-sm font-semibold text-action-fg disabled:opacity-60"
            disabled={
              create.isPending ||
              name.trim().length === 0 ||
              target.trim().length === 0
            }
            type="submit"
          >
            Ajouter le canal
          </button>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  )
}
