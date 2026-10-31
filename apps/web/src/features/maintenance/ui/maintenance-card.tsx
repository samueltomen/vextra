import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, Wrench } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { ApiError } from '../../../api/client.ts'
import { useNow } from '../../../lib/use-now.ts'
import { listMonitors } from '../../monitoring/api/monitoring-api.ts'
import {
  createMaintenance,
  deleteMaintenance,
  listMaintenance,
} from '../api/maintenance-api.ts'
import {
  buildWindowRange,
  DURATION_OPTIONS,
  toLocalInputValue,
  windowState,
} from '../model/maintenance-window.ts'

const QUERY_KEY = ['maintenance'] as const

const formatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function describeError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'limit_reached') {
    return 'Limite de 100 fenêtres à venir atteinte.'
  }

  if (error instanceof ApiError && error.code === 'monitor_not_found') {
    return 'Ce moniteur n’existe plus.'
  }

  return 'La fenêtre n’a pas pu être créée. Vérifiez les informations.'
}

export function MaintenanceCard() {
  const queryClient = useQueryClient()
  const nowMs = useNow()
  const windowsQuery = useQuery({
    queryFn: listMaintenance,
    queryKey: QUERY_KEY,
  })
  const monitorsQuery = useQuery({
    queryFn: listMonitors,
    queryKey: ['monitors', null],
  })
  const [name, setName] = useState('')
  const [monitorId, setMonitorId] = useState('')
  const [start, setStart] = useState(() => toLocalInputValue(Date.now()))
  const [duration, setDuration] = useState(60)
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  const create = useMutation({
    mutationFn: () => {
      const range = buildWindowRange(start, duration)

      if (range === null) {
        return Promise.reject(new Error('invalid start'))
      }

      return createMaintenance({
        ...range,
        monitorId: monitorId === '' ? null : monitorId,
        name: name.trim(),
      })
    },
    onSuccess: async () => {
      setName('')
      await refresh()
    },
  })
  const remove = useMutation({
    mutationFn: deleteMaintenance,
    onSuccess: refresh,
  })
  const monitorNames = new Map(
    (monitorsQuery.data ?? []).map((monitor) => [
      monitor.id,
      monitor.localLabel,
    ]),
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2 text-action">
        <Wrench aria-hidden="true" size={18} />
        <h2 className="text-sm font-semibold">Fenêtres de maintenance</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">
        Pendant une fenêtre, aucun incident ni alerte n’est déclenché pour les
        moniteurs concernés (et pendant leur marge qui suit). Les moniteurs
        apparaissent « en maintenance » sur la page de statut.
      </p>

      {windowsQuery.data && windowsQuery.data.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {windowsQuery.data.map((window) => (
            <li
              className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-canvas/40 p-3"
              key={window.id}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {window.name}
                  <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                    {windowState(window, nowMs) === 'active'
                      ? 'En cours'
                      : 'Planifiée'}
                  </span>
                </p>
                <p className="font-mono text-xs text-muted">
                  {formatter.format(new Date(window.startsAt))} →{' '}
                  {formatter.format(new Date(window.endsAt))} ·{' '}
                  {window.monitorId === null
                    ? 'Tous les moniteurs'
                    : (monitorNames.get(window.monitorId) ?? 'Un moniteur')}
                </p>
              </div>
              <button
                aria-label={`Supprimer la fenêtre ${window.name}`}
                className="grid size-9 place-items-center rounded-md border border-line text-muted hover:border-danger-border hover:text-danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(window.id)}
                type="button"
              >
                <Trash2 aria-hidden="true" size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Aucune fenêtre de maintenance planifiée.
        </p>
      )}

      <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1.5 block font-medium">Nom</span>
          <input
            className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none focus:border-action"
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Migration de la base"
            value={name}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Moniteur concerné</span>
          <select
            className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none focus:border-action"
            onChange={(event) => setMonitorId(event.target.value)}
            value={monitorId}
          >
            <option value="">Tous les moniteurs</option>
            {(monitorsQuery.data ?? []).map((monitor) => (
              <option key={monitor.id} value={monitor.id}>
                {monitor.localLabel}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Durée</span>
          <select
            className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none focus:border-action"
            onChange={(event) => setDuration(Number(event.target.value))}
            value={duration}
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1.5 block font-medium">Début</span>
          <input
            className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none focus:border-action"
            onChange={(event) => setStart(event.target.value)}
            type="datetime-local"
            value={start}
          />
        </label>
        {create.isError ? (
          <p
            className="rounded-lg border border-danger-border bg-danger-bg p-3 text-sm text-danger sm:col-span-2"
            role="alert"
          >
            {describeError(create.error)}
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <button
            className="min-h-10 rounded-md bg-action px-4 text-sm font-semibold text-action-fg disabled:opacity-60"
            disabled={create.isPending || name.trim().length === 0}
            type="submit"
          >
            Planifier la maintenance
          </button>
        </div>
      </form>
    </section>
  )
}
