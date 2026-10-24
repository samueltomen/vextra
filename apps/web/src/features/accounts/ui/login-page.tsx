import { Button, Input } from '@heroui/react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Activity, ArrowRight, LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'

import { ApiError } from '../../../api/client.ts'
import { readFieldError } from '../../../lib/read-field-error.ts'
import { getCurrentAccount, signIn, signUp } from '../api/account-api.ts'
import { CURRENT_ACCOUNT_QUERY_KEY } from '../query/use-current-account.ts'

type AuthMode = 'signin' | 'signup'

function AuthForm({ mode }: Readonly<{ mode: AuthMode }>) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(
    null,
  )
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      setConfirmationEmail(null)

      try {
        if (mode === 'signin') {
          const account = await signIn(value)

          queryClient.setQueryData(CURRENT_ACCOUNT_QUERY_KEY, account)
          await navigate({ to: '/' })
          return
        }

        const result = await signUp(value)

        if (result.requiresEmailConfirmation) {
          setConfirmationEmail(result.user.email)
          return
        }

        const account = await getCurrentAccount()

        if (!account) {
          setSubmitError(
            'Le compte a été créé, mais la session n’a pas pu être ouverte.',
          )
          return
        }

        queryClient.setQueryData(CURRENT_ACCOUNT_QUERY_KEY, account)
        await navigate({ to: '/' })
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setSubmitError('Adresse e-mail ou mot de passe incorrect.')
          return
        }

        setSubmitError(
          mode === 'signin'
            ? 'La connexion a échoué. Réessayez dans quelques instants.'
            : 'Le compte n’a pas pu être créé. Vérifiez vos informations.',
        )
      }
    },
  })

  return (
    <form
      className="mt-8 space-y-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <form.Field
        name="email"
        validators={{
          onChange: ({ value }) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim())
              ? undefined
              : 'Saisissez une adresse e-mail valide.',
        }}
      >
        {(field) => {
          const error = readFieldError(field.state.meta.errors)

          return (
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="email">
                Adresse e-mail
              </label>
              <Input
                {...(error ? { 'aria-describedby': 'email-error' } : {})}
                aria-invalid={Boolean(error)}
                autoComplete="email"
                id="email"
                isInvalid={Boolean(error)}
                onBlur={field.handleBlur}
                onValueChange={field.handleChange}
                placeholder="vous@exemple.fr"
                radius="md"
                startContent={
                  <Mail aria-hidden="true" className="text-muted" size={17} />
                }
                type="email"
                value={field.state.value}
              />
              {error ? (
                <p
                  className="mt-2 text-sm text-danger"
                  id="email-error"
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
        name="password"
        validators={{
          onChange: ({ value }) =>
            mode === 'signup' && value.length < 12
              ? 'Utilisez au moins 12 caractères.'
              : value.length === 0
                ? 'Saisissez votre mot de passe.'
                : undefined,
        }}
      >
        {(field) => {
          const error = readFieldError(field.state.meta.errors)

          return (
            <div>
              <label
                className="mb-2 block text-sm font-medium"
                htmlFor="password"
              >
                Mot de passe
              </label>
              <Input
                aria-describedby={`password-help${
                  error ? ' password-error' : ''
                }`}
                aria-invalid={Boolean(error)}
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                id="password"
                isInvalid={Boolean(error)}
                onBlur={field.handleBlur}
                onValueChange={field.handleChange}
                radius="md"
                startContent={
                  <LockKeyhole
                    aria-hidden="true"
                    className="text-muted"
                    size={17}
                  />
                }
                type="password"
                value={field.state.value}
              />
              <p
                className="mt-2 text-xs leading-5 text-muted"
                id="password-help"
              >
                {mode === 'signup'
                  ? '12 caractères minimum. Votre mot de passe reste géré par Supabase Auth.'
                  : 'Votre session sera conservée dans un cookie sécurisé.'}
              </p>
              {error ? (
                <p
                  className="mt-2 text-sm text-danger"
                  id="password-error"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </div>
          )
        }}
      </form.Field>

      {confirmationEmail ? (
        <p
          className="rounded-lg border border-healthy-border bg-healthy-bg p-3 text-sm leading-6 text-healthy"
          role="status"
        >
          Un lien de confirmation a été envoyé à {confirmationEmail}.
        </p>
      ) : null}

      {submitError ? (
        <p
          className="rounded-lg border border-danger-border bg-danger-bg p-3 text-sm leading-6 text-danger"
          role="alert"
        >
          {submitError}
        </p>
      ) : null}

      <Button
        className="min-h-12 w-full bg-action font-semibold text-white"
        isLoading={form.state.isSubmitting}
        radius="md"
        type="submit"
      >
        {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
        <ArrowRight aria-hidden="true" size={17} />
      </Button>
    </form>
  )
}

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('signin')

  return (
    <main className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.8fr)]">
      <section className="hidden flex-col justify-between border-r border-line bg-surface p-10 lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-ink text-white">
            <Activity aria-hidden="true" size={21} />
          </span>
          <span className="text-lg font-semibold tracking-tight">CronPing</span>
        </div>

        <div className="max-w-xl">
          <p className="text-sm font-semibold text-action">
            Surveillance sans intrusion
          </p>
          <p className="mt-4 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Sachez quand vos tâches cessent de parler.
          </p>
          <p className="mt-5 max-w-lg text-lg leading-8 text-muted">
            CronPing reçoit uniquement les heartbeats. Le contenu de vos
            scripts, commandes et journaux reste sur vos serveurs.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-muted">
            <li>Un état clair, sans historique d’exécution.</li>
            <li>Une session chiffrée, jamais de token dans le navigateur.</li>
            <li>Une alerte lorsque le silence devient anormal.</li>
          </ul>
        </div>

        <p className="text-xs leading-5 text-muted">
          Aucun script, cron, log ou secret d’exécution n’est enregistré.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-lg bg-ink text-white">
              <Activity aria-hidden="true" size={21} />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              CronPing
            </span>
          </div>

          <div
            aria-label="Choisir entre connexion et inscription"
            className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface p-1"
            role="group"
          >
            {(
              [
                ['signin', 'Connexion'],
                ['signup', 'Inscription'],
              ] as const
            ).map(([value, label]) => (
              <button
                aria-pressed={mode === value}
                className={`min-h-10 rounded-md px-3 text-sm font-medium ${
                  mode === value
                    ? 'bg-ink text-white'
                    : 'text-muted hover:text-ink'
                }`}
                key={value}
                onClick={() => setMode(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-8">
            <p className="text-sm font-medium text-action">
              {mode === 'signin' ? 'Heureux de vous revoir' : 'Nouveau compte'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {mode === 'signin'
                ? 'Accéder à vos moniteurs'
                : 'Commencer la surveillance'}
            </h1>
          </div>

          <AuthForm key={mode} mode={mode} />
        </div>
      </section>
    </main>
  )
}
