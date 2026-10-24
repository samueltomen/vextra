import { Button, Input } from '@heroui/react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  KeyRound,
  Loader2,
  LockKeyhole,
  RadioTower,
  Timer,
} from 'lucide-react'
import { useState } from 'react'

import { CodeTabs } from '../../../components/code-tabs.tsx'
import { readFieldError } from '../../../lib/read-field-error.ts'
import {
  createMonitor,
  getMonitor,
  type CreatedMonitor,
} from '../api/monitoring-api.ts'
import { formatDuration } from '../model/availability.ts'
import { buildIntegrationSnippets } from '../model/integration-snippets.ts'
import { formatFrequency } from '../model/monitor-format.ts'
import { DurationPicker } from './duration-picker.tsx'
import {
  GRACE_PRESETS,
  INTERVAL_PRESETS,
  validateGrace,
  validateInterval,
} from './schedule-presets.ts'

const FIRST_SIGNAL_POLL_MS = 3_000

function FirstSignalStatus({ monitorId }: Readonly<{ monitorId: string }>) {
  const monitorQuery = useQuery({
    queryKey: ['monitors', monitorId],
    queryFn: () => getMonitor(monitorId),
    refetchInterval: (query) =>
      query.state.data?.lastHeartbeatAtMs ? false : FIRST_SIGNAL_POLL_MS,
  })
  const received = Boolean(monitorQuery.data?.lastHeartbeatAtMs)

  return (
    <div
      aria-live="polite"
      className={`flex items-start gap-3 rounded-xl border p-4 ${
        received
          ? 'border-healthy-border bg-healthy-bg text-healthy'
          : 'border-line bg-canvas text-ink'
      }`}
      role="status"
    >
      {received ? (
        <Check aria-hidden="true" className="mt-0.5 shrink-0" size={19} />
      ) : (
        <Loader2
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-action motion-safe:animate-spin"
          size={19}
        />
      )}
      <div>
        <p className="font-semibold">
          {received ? 'Premier signal reçu' : 'En attente du premier signal'}
        </p>
        <p className="mt-1 text-sm text-muted">
          {received
            ? 'Votre moniteur est opérationnel et surveille votre tâche.'
            : 'Exécutez la commande une fois : cette page vérifie automatiquement toutes les 3 secondes.'}
        </p>
      </div>
    </div>
  )
}

function SuccessState({
  created,
  onCreateAnother,
}: Readonly<{ created: CreatedMonitor; onCreateAnother: () => void }>) {
  const navigate = useNavigate()
  const pingUrl = new URL('/api/ping', window.location.origin).toString()
  const snippets = buildIntegrationSnippets({
    intervalMinutes: created.monitor.intervalMinutes,
    pingUrl,
    token: created.heartbeatToken,
  })

  return (
    <section className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-healthy-border bg-surface p-6 shadow-card sm:p-8">
        <span className="grid size-12 place-items-center rounded-full bg-healthy-bg text-healthy">
          <Check aria-hidden="true" size={24} />
        </span>
        <p className="mt-5 text-sm font-semibold text-healthy">Moniteur créé</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {created.monitor.localLabel}
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Copiez cette commande maintenant. Le token complet ne sera plus
          affiché après avoir quitté cet écran.
        </p>

        <div className="mt-6 rounded-xl border border-line p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <KeyRound aria-hidden="true" size={16} />
            Token affiché une seule fois
          </div>
          <CodeTabs snippets={snippets} />
        </div>

        <div className="mt-5">
          <FirstSignalStatus monitorId={created.monitor.id} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
          <Button
            className="min-h-11 bg-action font-semibold text-action-fg"
            onPress={() =>
              void navigate({
                params: { monitorId: created.monitor.id },
                to: '/monitors/$monitorId',
              })
            }
            radius="md"
          >
            Voir le moniteur
          </Button>
          <Button
            className="min-h-11 border-line"
            onPress={onCreateAnother}
            radius="md"
            variant="bordered"
          >
            Ajouter un autre moniteur
          </Button>
        </div>
      </div>
    </section>
  )
}

export function CreateMonitorPage() {
  const [created, setCreated] = useState<CreatedMonitor | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const mutation = useMutation({ mutationFn: createMonitor })
  const form = useForm({
    defaultValues: {
      localLabel: '',
      intervalMinutes: 5,
      graceMinutes: 2,
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null)

      try {
        const result = await mutation.mutateAsync(value)
        await queryClient.invalidateQueries({ queryKey: ['monitors'] })
        setCreated(result)
      } catch {
        setSubmitError(
          'Le moniteur n’a pas pu être créé. Vérifiez les informations puis réessayez.',
        )
      }
    },
  })

  if (created) {
    return (
      <SuccessState
        created={created}
        onCreateAnother={() => {
          form.reset()
          setCreated(null)
        }}
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted hover:text-ink"
        to="/"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        Retour aux moniteurs
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <p className="text-sm font-semibold text-action">Nouveau moniteur</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Ajouter un heartbeat
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            CronPing ne reçoit qu&apos;un signal. Le contenu du script et de la
            tâche planifiée reste sur votre serveur.
          </p>

          <form
            className="mt-8 space-y-7 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6"
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <form.Field
              name="localLabel"
              validators={{
                onChange: ({ value }) =>
                  value.trim().length === 0
                    ? 'Donnez un libellé à ce moniteur.'
                    : undefined,
              }}
            >
              {(field) => {
                const error = readFieldError(field.state.meta.errors)

                return (
                  <div>
                    <label
                      className="mb-2 block text-sm font-medium"
                      htmlFor={field.name}
                    >
                      Libellé local
                    </label>
                    <Input
                      aria-describedby={`${field.name}-help${
                        error ? ` ${field.name}-error` : ''
                      }`}
                      aria-invalid={Boolean(error)}
                      id={field.name}
                      isInvalid={Boolean(error)}
                      onBlur={field.handleBlur}
                      onValueChange={field.handleChange}
                      placeholder="Sauvegarde PostgreSQL"
                      radius="md"
                      value={field.state.value}
                    />
                    <p
                      className="mt-2 text-xs leading-5 text-muted"
                      id={`${field.name}-help`}
                    >
                      Stocké localement dans ce prototype ; jamais envoyé au
                      serveur.
                    </p>
                    {error ? (
                      <p
                        className="mt-2 text-sm text-danger"
                        id={`${field.name}-error`}
                        role="alert"
                      >
                        {error}
                      </p>
                    ) : null}
                  </div>
                )
              }}
            </form.Field>

            <form.Field
              name="intervalMinutes"
              validators={{
                onChange: ({ value }) => validateInterval(value),
              }}
            >
              {(field) => (
                <DurationPicker
                  description="Le rythme auquel votre tâche doit envoyer un signal."
                  error={readFieldError(field.state.meta.errors)}
                  label="Fréquence attendue"
                  onChange={field.handleChange}
                  presets={INTERVAL_PRESETS}
                  value={field.state.value}
                />
              )}
            </form.Field>

            <form.Field
              name="graceMinutes"
              validators={{
                onChange: ({ value }) => validateGrace(value),
              }}
            >
              {(field) => (
                <DurationPicker
                  description="Temps accordé avant l’alerte, pour absorber les exécutions lentes."
                  error={readFieldError(field.state.meta.errors)}
                  label="Marge"
                  onChange={field.handleChange}
                  presets={GRACE_PRESETS}
                  value={field.state.value}
                />
              )}
            </form.Field>

            {submitError ? (
              <p
                className="rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger"
                role="alert"
              >
                {submitError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
              <Button
                className="min-h-11 border-line"
                onPress={() => void navigate({ to: '/' })}
                radius="md"
                variant="bordered"
              >
                Annuler
              </Button>
              <Button
                className="min-h-11 bg-action px-5 font-semibold text-action-fg"
                isLoading={form.state.isSubmitting || mutation.isPending}
                radius="md"
                type="submit"
              >
                Créer le moniteur
              </Button>
            </div>
          </form>
        </section>

        <aside
          aria-label="Résumé de la configuration"
          className="h-fit space-y-4"
        >
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                <div className="flex items-center gap-2 text-action">
                  <Timer aria-hidden="true" size={18} />
                  <h2 className="text-sm font-semibold">Aperçu</h2>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Signal attendu</dt>
                    <dd className="text-right font-medium">
                      {formatFrequency(values.intervalMinutes)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Alerte après</dt>
                    <dd className="text-right font-medium">
                      {formatDuration(
                        (values.intervalMinutes + values.graceMinutes) * 60_000,
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-5 text-muted">
                  Sans signal pendant ce délai, un incident est ouvert et vous
                  recevez un e-mail.
                </p>
              </div>
            )}
          </form.Subscribe>

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center gap-2 text-action">
              <RadioTower aria-hidden="true" size={18} />
              <h2 className="text-sm font-semibold">Fonctionnement</h2>
            </div>
            <ol className="mt-5 space-y-4 text-sm text-muted">
              <li>1. CronPing génère une commande unique.</li>
              <li>2. Votre script appelle cette commande à la fin.</li>
              <li>3. Sans signal avant l’échéance, une alerte est créée.</li>
            </ol>
            <div className="mt-6 flex gap-3 rounded-lg bg-canvas p-3">
              <LockKeyhole
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-healthy"
                size={17}
              />
              <p className="text-xs leading-5 text-muted">
                Aucun script, log ou commande cron ne sera enregistré.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
