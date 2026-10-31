import type { Preferences } from '@cronping/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { listTimeZones } from '../../../lib/display-time.ts'
import { DurationPicker } from '../../monitoring/ui/duration-picker.tsx'
import {
  GRACE_PRESETS,
  INTERVAL_PRESETS,
  validateGrace,
  validateInterval,
} from '../../monitoring/ui/schedule-presets.ts'
import { updatePreferences } from '../api/workspace-api.ts'
import { useFolders } from '../query/use-folders.ts'
import {
  applyDisplayPreferences,
  PREFERENCES_QUERY_KEY,
  usePreferences,
} from '../query/use-preferences.ts'

function SelectField({
  label,
  onChange,
  options,
  value,
}: Readonly<{
  label: string
  onChange: (value: string) => void
  options: readonly (readonly [string, string])[]
  value: string
}>) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium">{label}</span>
      <select
        className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none focus:border-action"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  )
}

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
        dashboardSort: draft.dashboardSort,
        dashboardView: draft.dashboardView,
        defaultFolderId: draft.defaultFolderId,
        defaultGraceMinutes: draft.defaultGraceMinutes,
        defaultIntervalMinutes: draft.defaultIntervalMinutes,
        density: draft.density,
        displayName: draft.displayName,
        notifyOnOpen: draft.notifyOnOpen,
        notifyOnResolve: draft.notifyOnResolve,
        reminderIntervalMinutes: draft.reminderIntervalMinutes,
        timeFormat: draft.timeFormat,
        timezone: draft.timezone,
      }),
    onSuccess: (next) => {
      applyDisplayPreferences(next)
      queryClient.setQueryData(PREFERENCES_QUERY_KEY, next)
      setSaved(true)
    },
  })
  const zones = listTimeZones()
  const folders = useFolders().data ?? []
  const intervalError = validateInterval(draft.defaultIntervalMinutes)
  const graceError = validateGrace(draft.defaultGraceMinutes)

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

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium">Affichage</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Format de l’heure"
            onChange={(timeFormat) =>
              change({ timeFormat: timeFormat as Preferences['timeFormat'] })
            }
            options={[
              ['24h', '24 heures'],
              ['12h', '12 heures (AM/PM)'],
            ]}
            value={draft.timeFormat}
          />
          <SelectField
            label="Densité de l’interface"
            onChange={(density) =>
              change({ density: density as Preferences['density'] })
            }
            options={[
              ['compact', 'Compacte'],
              ['comfortable', 'Confortable'],
            ]}
            value={draft.density}
          />
          <SelectField
            label="Vue par défaut du dashboard"
            onChange={(dashboardView) =>
              change({
                dashboardView: dashboardView as Preferences['dashboardView'],
              })
            }
            options={[
              ['list', 'Liste'],
              ['grid', 'Grille'],
            ]}
            value={draft.dashboardView}
          />
          <SelectField
            label="Tri par défaut"
            onChange={(dashboardSort) =>
              change({
                dashboardSort: dashboardSort as Preferences['dashboardSort'],
              })
            }
            options={[
              ['priority', 'Priorité'],
              ['name', 'Nom'],
              ['signal', 'Dernier signal'],
              ['recent', 'Plus récents'],
            ]}
            value={draft.dashboardSort}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-medium">
          Valeurs par défaut des nouveaux moniteurs
        </legend>
        <DurationPicker
          description="Intervalle proposé à la création d’un moniteur."
          error={intervalError}
          label="Fréquence par défaut"
          onChange={(defaultIntervalMinutes) =>
            change({ defaultIntervalMinutes })
          }
          presets={INTERVAL_PRESETS}
          value={draft.defaultIntervalMinutes}
        />
        <DurationPicker
          description="Délai de tolérance proposé avant d’ouvrir un incident."
          error={graceError}
          label="Marge par défaut"
          onChange={(defaultGraceMinutes) => change({ defaultGraceMinutes })}
          presets={GRACE_PRESETS}
          value={draft.defaultGraceMinutes}
        />
        <SelectField
          label="Dossier par défaut"
          onChange={(folderId) =>
            change({ defaultFolderId: folderId === '' ? null : folderId })
          }
          options={[
            ['', 'Aucun dossier'],
            ...folders.map((folder) => [folder.id, folder.name] as const),
          ]}
          value={draft.defaultFolderId ?? ''}
        />
      </fieldset>

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
        <SelectField
          label="Rappel tant qu’un incident reste ouvert"
          onChange={(reminder) =>
            change({
              reminderIntervalMinutes:
                reminder === ''
                  ? null
                  : (Number(
                      reminder,
                    ) as Preferences['reminderIntervalMinutes']),
            })
          }
          options={[
            ['', 'Aucun rappel'],
            ['60', 'Toutes les heures'],
            ['360', 'Toutes les 6 heures'],
            ['1440', 'Tous les jours'],
            ['10080', 'Toutes les semaines'],
          ]}
          value={
            draft.reminderIntervalMinutes === null
              ? ''
              : String(draft.reminderIntervalMinutes)
          }
        />
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          className="min-h-10 rounded-md bg-action px-4 text-sm font-semibold text-action-fg disabled:opacity-60"
          disabled={save.isPending || Boolean(intervalError || graceError)}
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
