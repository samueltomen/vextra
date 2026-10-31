import type { Preferences } from '@cronping/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { listTimeZones, setDisplayTimeZone } from '../../../lib/display-time.ts'
import { updatePreferences } from '../api/workspace-api.ts'
import {
  PREFERENCES_QUERY_KEY,
  usePreferences,
} from '../query/use-preferences.ts'

function Toggle({
  checked,
  description,
  label,
  onChange,
}: Readonly<{
  checked: boolean
  description: string
  label: string
  onChange: (checked: boolean) => void
}>) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-canvas/40 p-3">
      <input
        checked={checked}
        className="mt-1 size-4 accent-[var(--cp-color-action)]"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
    </label>
  )
}

function PreferencesForm({ initial }: Readonly<{ initial: Preferences }>) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Preferences>(initial)
  const [saved, setSaved] = useState(false)
  const save = useMutation({
    mutationFn: () =>
      updatePreferences({
        displayName: draft.displayName,
        notifyOnOpen: draft.notifyOnOpen,
        notifyOnResolve: draft.notifyOnResolve,
        timezone: draft.timezone,
      }),
    onSuccess: (next) => {
      setDisplayTimeZone(next.timezone)
      queryClient.setQueryData(PREFERENCES_QUERY_KEY, next)
      setSaved(true)
    },
  })
  const zones = listTimeZones()

  function change(changes: Partial<Preferences>) {
    setSaved(false)
    setDraft((current) => ({ ...current, ...changes }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form className="mt-4 space-y-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Nom affiché</span>
          <input
            className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none placeholder:text-muted focus:border-action"
            maxLength={60}
            onChange={(event) =>
              change({ displayName: event.target.value || null })
            }
            placeholder="Facultatif"
            value={draft.displayName ?? ''}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Fuseau horaire</span>
          <select
            className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none focus:border-action"
            onChange={(event) => change({ timezone: event.target.value })}
            value={draft.timezone}
          >
            {(zones.includes(draft.timezone)
              ? zones
              : [draft.timezone, ...zones]
            ).map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Alertes par e-mail</legend>
        <Toggle
          checked={draft.notifyOnOpen}
          description="Un e-mail quand un heartbeat n’arrive pas à temps."
          label="Incident ouvert"
          onChange={(notifyOnOpen) => change({ notifyOnOpen })}
        />
        <Toggle
          checked={draft.notifyOnResolve}
          description="Un e-mail quand le moniteur reçoit de nouveau un heartbeat."
          label="Incident résolu"
          onChange={(notifyOnResolve) => change({ notifyOnResolve })}
        />
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          className="min-h-10 rounded-md bg-action px-4 text-sm font-semibold text-action-fg disabled:opacity-60"
          disabled={save.isPending}
          type="submit"
        >
          Enregistrer les préférences
        </button>
        {saved ? (
          <p className="text-sm text-healthy" role="status">
            Préférences enregistrées.
          </p>
        ) : null}
        {save.isError ? (
          <p className="text-sm text-danger" role="alert">
            L’enregistrement a échoué. Réessayez.
          </p>
        ) : null}
      </div>
    </form>
  )
}

export function PreferencesCard() {
  const preferences = usePreferences()

  return (
    <section
      aria-labelledby="preferences-title"
      className="rounded-xl border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 text-action">
        <SlidersHorizontal aria-hidden="true" size={18} />
        <h2 className="text-sm font-semibold" id="preferences-title">
          Préférences
        </h2>
      </div>
      {preferences.isPending ? (
        <p className="mt-4 text-sm text-muted" role="status">
          Chargement des préférences…
        </p>
      ) : preferences.isError ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          Impossible de charger vos préférences.
        </p>
      ) : (
        <PreferencesForm initial={preferences.data} />
      )}
    </section>
  )
}
