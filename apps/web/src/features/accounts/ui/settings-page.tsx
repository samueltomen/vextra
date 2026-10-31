import { Button, Input } from '@heroui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Bell, Mail, ShieldAlert, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { deleteAccount } from '../api/account-api.ts'
import { PreferencesCard } from '../../workspace/ui/preferences-card.tsx'
import { useCurrentAccount } from '../query/use-current-account.ts'

export function SettingsPage() {
  const [confirmation, setConfirmation] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const accountQuery = useCurrentAccount()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const deletion = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      queryClient.clear()
      await navigate({ replace: true, to: '/login' })
    },
  })
  const account = accountQuery.data
  const canDelete = confirmation === 'SUPPRIMER'

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="mb-2 text-sm font-medium text-action">Compte</p>
        <h1 className="text-xl font-semibold tracking-tight">Réglages</h1>
        <p className="mt-3 text-muted">
          Gérez votre compte, votre adresse de notification et les données de
          votre espace personnel.
        </p>
      </header>

      <PreferencesCard />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center gap-2 text-action">
            <Mail aria-hidden="true" size={18} />
            <h2 className="text-sm font-semibold">Compte</h2>
          </div>
          <p className="mt-4 text-sm text-muted">Adresse e-mail</p>
          <p className="mt-1 truncate font-semibold">
            {account?.user.email ?? 'Compte connecté'}
          </p>
          <p className="mt-4 text-sm text-muted">Espace personnel</p>
          <p className="mt-1 font-mono text-xs">
            {account?.tenantId.slice(0, 8) ?? '—'}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center gap-2 text-healthy">
            <Bell aria-hidden="true" size={18} />
            <h2 className="text-sm font-semibold">Notifications</h2>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">
            Les alertes d’incident et de reprise utilisent l’adresse e-mail du
            compte.
          </p>
          <Link
            className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-action hover:underline"
            to="/notifications"
          >
            Consulter les envois
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-danger-border bg-danger-bg p-5 text-danger sm:p-6">
        <div className="flex gap-3">
          <ShieldAlert
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            size={20}
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Supprimer mon compte</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6">
              Cette action supprime définitivement le compte, les moniteurs, les
              incidents et l’historique des notifications. Elle est
              irréversible.
            </p>
            <label
              className="mt-5 block text-sm font-medium"
              htmlFor="delete-confirmation"
            >
              Saisissez SUPPRIMER pour confirmer
            </label>
            <Input
              {...(deleteError
                ? { 'aria-describedby': 'delete-account-error' }
                : {})}
              className="mt-2 max-w-sm"
              id="delete-confirmation"
              onValueChange={setConfirmation}
              radius="md"
              value={confirmation}
            />
            {deleteError ? (
              <p
                className="mt-2 text-sm"
                id="delete-account-error"
                role="alert"
              >
                {deleteError}
              </p>
            ) : null}
            <Button
              className="mt-4 min-h-11 bg-danger text-white dark:text-[#2d1010]"
              isDisabled={!canDelete}
              isLoading={deletion.isPending}
              onPress={() => {
                setDeleteError(null)
                deletion.mutate(undefined, {
                  onError: () =>
                    setDeleteError(
                      'La suppression du compte a échoué. Réessayez ou contactez le support.',
                    ),
                })
              }}
              radius="md"
              startContent={<Trash2 aria-hidden="true" size={17} />}
            >
              Supprimer définitivement
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
