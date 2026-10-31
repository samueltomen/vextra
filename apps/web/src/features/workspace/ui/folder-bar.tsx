import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Folder, FolderCog, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ApiError } from '../../../api/client.ts'
import {
  createFolder,
  deleteFolder,
  renameFolder,
  type FolderView,
} from '../api/workspace-api.ts'
import { FOLDERS_QUERY_KEY, type FolderFilter } from '../query/use-folders.ts'

function describeError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'folder_name_taken') {
    return 'Ce nom de dossier est déjà utilisé.'
  }

  if (error instanceof ApiError && error.code === 'folder_limit_reached') {
    return 'Limite de 50 dossiers atteinte.'
  }

  return 'L’opération a échoué. Réessayez.'
}

function Chip({
  active,
  count,
  label,
  onClick,
}: Readonly<{
  active: boolean
  count: number
  label: string
  onClick: () => void
}>) {
  return (
    <button
      aria-pressed={active}
      className={`flex min-h-8 items-center gap-2 rounded-md border px-3 text-sm transition-colors ${
        active
          ? 'border-action bg-action-soft text-action'
          : 'border-line bg-surface text-ink hover:border-border-strong'
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="max-w-40 truncate">{label}</span>{' '}
      <span className="font-mono text-xs text-muted tabular-nums">{count}</span>
    </button>
  )
}

function FolderRow({ folder }: Readonly<{ folder: FolderView }>) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(folder.name)
  const [error, setError] = useState<string | null>(null)
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: FOLDERS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['monitors'] }),
    ])
  const rename = useMutation({
    mutationFn: (next: string) => renameFolder(folder.id, next),
    onError: (cause) => setError(describeError(cause)),
    onSuccess: async () => {
      setError(null)
      await refresh()
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteFolder(folder.id),
    onError: (cause) => setError(describeError(cause)),
    onSuccess: refresh,
  })

  function commit() {
    const next = name.trim()

    if (next.length > 0 && next !== folder.name) {
      rename.mutate(next)
    } else {
      setName(folder.name)
    }
  }

  return (
    <li>
      <div className="flex items-center gap-2">
        <input
          aria-label={`Renommer ${folder.name}`}
          className="min-h-9 min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-action"
          maxLength={40}
          onBlur={commit}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
          value={name}
        />
        <button
          aria-label={`Supprimer le dossier ${folder.name}`}
          className="grid size-9 place-items-center rounded-md border border-line text-muted hover:border-danger-border hover:text-danger"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
          type="button"
        >
          <Trash2 aria-hidden="true" size={15} />
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  )
}

function ManageFolders({
  folders,
}: Readonly<{ folders: readonly FolderView[] }>) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: createFolder,
    onError: (cause) => setError(describeError(cause)),
    onSuccess: async () => {
      setName('')
      setError(null)
      await queryClient.invalidateQueries({ queryKey: FOLDERS_QUERY_KEY })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()

    if (name.trim().length > 0) {
      create.mutate(name.trim())
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface p-4">
      <form className="flex gap-2" onSubmit={submit}>
        <input
          aria-label="Nom du nouveau dossier"
          className="min-h-9 min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-action"
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nouveau dossier (ex. Production)"
          value={name}
        />
        <button
          className="flex min-h-9 items-center gap-1.5 rounded-md bg-action px-3 text-sm font-semibold text-action-fg disabled:opacity-60"
          disabled={create.isPending || name.trim().length === 0}
          type="submit"
        >
          <Plus aria-hidden="true" size={15} />
          Ajouter
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {folders.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {folders.map((folder) => (
            <FolderRow folder={folder} key={folder.id} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Aucun dossier. Créez-en un pour organiser vos moniteurs.
        </p>
      )}
    </div>
  )
}

export function FolderBar({
  activeFilter,
  counts,
  folders,
  onSelect,
  total,
}: Readonly<{
  activeFilter: FolderFilter
  counts: Readonly<Record<string, number>>
  folders: readonly FolderView[]
  onSelect: (filter: FolderFilter) => void
  total: number
}>) {
  const [managing, setManaging] = useState(false)

  return (
    <section aria-label="Dossiers">
      <div className="flex flex-wrap items-center gap-2">
        <Folder aria-hidden="true" className="text-muted" size={16} />
        <Chip
          active={activeFilter === 'all'}
          count={total}
          label="Tous"
          onClick={() => onSelect('all')}
        />
        {folders.map((folder) => (
          <Chip
            active={activeFilter === folder.id}
            count={counts[folder.id] ?? 0}
            key={folder.id}
            label={folder.name}
            onClick={() =>
              onSelect(activeFilter === folder.id ? 'all' : folder.id)
            }
          />
        ))}
        {folders.length > 0 ? (
          <Chip
            active={activeFilter === 'none'}
            count={counts['none'] ?? 0}
            label="Sans dossier"
            onClick={() => onSelect(activeFilter === 'none' ? 'all' : 'none')}
          />
        ) : null}
        <button
          aria-expanded={managing}
          className="ml-auto flex min-h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted hover:text-ink"
          onClick={() => setManaging((open) => !open)}
          type="button"
        >
          <FolderCog aria-hidden="true" size={15} />
          Gérer les dossiers
        </button>
      </div>
      {managing ? <ManageFolders folders={folders} /> : null}
    </section>
  )
}
