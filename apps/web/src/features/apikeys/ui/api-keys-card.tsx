import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clipboard, KeyRound, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ApiError } from '../../../api/client.ts'
import { useCurrentAccount } from '../../accounts/query/use-current-account.ts'
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type CreatedApiKey,
} from '../api/api-keys-api.ts'

const QUERY_KEY = ['api-keys'] as const

const formatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function describeError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'forbidden') {
    return 'Seul le propriétaire de l’espace peut gérer les clés.'
  }

  if (error instanceof ApiError && error.code === 'limit_reached') {
    return 'Limite de 10 clés actives atteinte. Révoquez-en une.'
  }

  return 'La clé n’a pas pu être créée. Réessayez.'
}

export function ApiKeysCard() {
  const queryClient = useQueryClient()
  const isOwner = useCurrentAccount().data?.role === 'owner'
  const keysQuery = useQuery({ queryFn: listApiKeys, queryKey: QUERY_KEY })
  const [name, setName] = useState('')
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const [copied, setCopied] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  const create = useMutation({
    mutationFn: () => createApiKey(name.trim()),
    onSuccess: async (result) => {
      setCreated(result)
      setCopied(false)
      setName('')
      await refresh()
    },
  })
  const revoke = useMutation({ mutationFn: revokeApiKey, onSuccess: refresh })
  const origin = window.location.origin

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  async function copy(secret: string) {
    await navigator.clipboard.writeText(secret)
    setCopied(true)
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2 text-action">
        <KeyRound aria-hidden="true" size={18} />
        <h2 className="text-sm font-semibold">Clés d’API</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">
        Interrogez vos moniteurs depuis un script ou un tableau de bord externe.
        Les clés sont en lecture seule et limitées à votre espace.
      </p>

      {created ? (
        <div
          className="mt-4 rounded-lg border border-healthy-border bg-healthy-bg p-3"
          role="status"
        >
          <p className="text-sm font-medium text-healthy">
            Clé « {created.apiKey.name} » créée. Copiez-la maintenant : elle ne
            sera plus affichée.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-canvas px-2 py-1 font-mono text-xs">
              {created.key}
            </code>
            <button
              className="flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm"
              onClick={() => void copy(created.key)}
              type="button"
            >
              {copied ? (
                <Check aria-hidden="true" size={14} />
              ) : (
                <Clipboard aria-hidden="true" size={14} />
              )}
              {copied ? 'Clé copiée' : 'Copier la clé'}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded bg-canvas p-2 font-mono text-xs">
            {`curl -H "Authorization: Bearer ${created.key}" ${origin}/api/v1/monitors`}
          </pre>
        </div>
      ) : null}

      {keysQuery.data && keysQuery.data.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {keysQuery.data.map((key) => (
            <li
              className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-canvas/40 p-3"
              key={key.id}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {key.name}
                  {key.revokedAt ? (
                    <span className="ml-2 rounded-full border border-danger-border px-2 py-0.5 text-[11px] text-danger">
                      Révoquée
                    </span>
                  ) : null}
                </p>
                <p className="font-mono text-xs text-muted">
                  {key.prefix}… · créée le{' '}
                  {formatter.format(new Date(key.createdAt))} ·{' '}
                  {key.lastUsedAt
                    ? `utilisée le ${formatter.format(new Date(key.lastUsedAt))}`
                    : 'jamais utilisée'}
                </p>
              </div>
              {key.revokedAt || !isOwner ? null : (
                <button
                  aria-label={`Révoquer la clé ${key.name}`}
                  className="grid size-9 place-items-center rounded-md border border-line text-muted hover:border-danger-border hover:text-danger"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(key.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">Aucune clé d’API.</p>
      )}

      {isOwner ? (
        <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={submit}>
          <label className="block min-w-48 flex-1 text-sm">
            <span className="mb-1.5 block font-medium">Nom de la clé</span>
            <input
              className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none focus:border-action"
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tableau de bord interne"
              value={name}
            />
          </label>
          <button
            className="min-h-10 rounded-md bg-action px-4 text-sm font-semibold text-action-fg disabled:opacity-60"
            disabled={create.isPending || name.trim().length === 0}
            type="submit"
          >
            Créer une clé
          </button>
        </form>
      ) : (
        <p className="mt-4 text-xs leading-5 text-muted">
          Seul le propriétaire de l’espace peut créer ou révoquer des clés : une
          clé donne accès à toutes les données de l’espace, même après le départ
          de la personne qui l’a créée.
        </p>
      )}
      {create.isError ? (
        <p
          className="mt-3 rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger"
          role="alert"
        >
          {describeError(create.error)}
        </p>
      ) : null}
    </section>
  )
}
