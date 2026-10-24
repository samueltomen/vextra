import { Button, Input, Select, SelectItem } from '@heroui/react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  Clipboard,
  KeyRound,
  LockKeyhole,
  RadioTower,
} from 'lucide-react'
import { useState } from 'react'

import { readFieldError } from '../../../lib/read-field-error.ts'
import { createMonitor, type CreatedMonitor } from '../api/monitoring-api.ts'

const INTERVAL_OPTIONS = [
  ['5', 'Toutes les 5 minutes'],
  ['15', 'Toutes les 15 minutes'],
  ['60', 'Toutes les heures'],
  ['1440', 'Tous les jours'],
  ['10080', 'Toutes les semaines'],
] as const

function SuccessState({ created }: Readonly<{ created: CreatedMonitor }>) {
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()
  const pingUrl = new URL('/api/ping', window.location.origin).toString()
  const command = `curl --fail --silent --show-error --retry 3 \\
  --request POST \\
  --header "Authorization: Bearer ${created.heartbeatToken}" \\
  "${pingUrl}"`

  async function copyCommand() {
    await navigator.clipboard.writeText(command)
    setCopied(true)
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="rounded-xl border border-healthy-border bg-surface p-6 sm:p-8">
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

        <div className="mt-6 rounded-lg border border-line bg-canvas">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-medium">
            <KeyRound aria-hidden="true" size={16} />
            Token affiché une seule fois
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-sm leading-6 text-ink">
            <code>{command}</code>
          </pre>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            className="min-h-11 bg-action text-white"
            onPress={() => void copyCommand()}
            radius="md"
          >
            {copied ? (
              <Check aria-hidden="true" size={17} />
            ) : (
              <Clipboard aria-hidden="true" size={17} />
            )}
            {copied ? 'Commande copiée' : 'Copier la commande'}
          </Button>
          <Button
            className="min-h-11 border-line"
            onPress={() =>
              void navigate({
                params: { monitorId: created.monitor.id },
                to: '/monitors/$monitorId',
              })
            }
            radius="md"
            variant="bordered"
          >
            Voir le moniteur
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
    return <SuccessState created={created} />
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
          <p className="text-sm font-medium text-action">Nouveau moniteur</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Ajouter un heartbeat
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            CronPing ne reçoit qu&apos;un signal. Le contenu du script et de la
            tâche planifiée reste sur votre serveur.
          </p>

          <form
            className="mt-8 space-y-6 rounded-xl border border-line bg-surface p-5 sm:p-6"
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

            <div className="grid gap-5 sm:grid-cols-2">
              <form.Field name="intervalMinutes">
                {(field) => (
                  <Select
                    label="Fréquence attendue"
                    onSelectionChange={(keys) => {
                      const selected = [...keys][0]
                      if (selected !== undefined) {
                        field.handleChange(Number(selected))
                      }
                    }}
                    radius="md"
                    selectedKeys={[String(field.state.value)]}
                  >
                    {INTERVAL_OPTIONS.map(([value, label]) => (
                      <SelectItem key={value}>{label}</SelectItem>
                    ))}
                  </Select>
                )}
              </form.Field>

              <form.Field
                name="graceMinutes"
                validators={{
                  onChange: ({ value }) =>
                    value < 0
                      ? 'La marge ne peut pas être négative.'
                      : undefined,
                }}
              >
                {(field) => {
                  const error = readFieldError(field.state.meta.errors)

                  return (
                    <Input
                      description="Temps accordé avant l’alerte."
                      errorMessage={error}
                      id={field.name}
                      isInvalid={Boolean(error)}
                      label="Marge"
                      min={0}
                      onBlur={field.handleBlur}
                      onValueChange={(value) =>
                        field.handleChange(Number(value))
                      }
                      radius="md"
                      type="number"
                      value={String(field.state.value)}
                    />
                  )
                }}
              </form.Field>
            </div>

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
                className="min-h-11 bg-action px-5 font-semibold text-white"
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
          className="h-fit rounded-xl border border-line bg-surface p-5"
        >
          <div className="flex items-center gap-2 text-action">
            <RadioTower aria-hidden="true" size={18} />
            <h2 className="text-sm font-semibold">Fonctionnement</h2>
          </div>
          <ol className="mt-5 space-y-4 text-sm text-muted">
            <li>1. CronPing génère une commande curl unique.</li>
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
        </aside>
      </div>
    </div>
  )
}
