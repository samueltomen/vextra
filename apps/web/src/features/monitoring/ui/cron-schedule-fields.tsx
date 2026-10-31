import { Input } from '@heroui/react'

import { listTimeZones } from '../../../lib/display-time.ts'
import {
  CRON_PRESETS,
  previewCronOccurrences,
  validateCronSchedule,
} from '../model/cron-schedule.ts'

export type ScheduleKind = 'cron' | 'interval'

export type CronDraft = Readonly<{ expression: string; timezone: string }>

const PREVIEW_COUNT = 4

export function ScheduleKindToggle({
  onChange,
  value,
}: Readonly<{ onChange: (kind: ScheduleKind) => void; value: ScheduleKind }>) {
  const options: readonly { id: ScheduleKind; label: string }[] = [
    { id: 'interval', label: 'Intervalle' },
    { id: 'cron', label: 'Expression cron' },
  ]

  return (
    <div
      aria-label="Type de planification"
      className="inline-flex rounded-lg border border-line bg-canvas p-1"
      role="radiogroup"
    >
      {options.map((option) => (
        <button
          aria-checked={value === option.id}
          className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${
            value === option.id
              ? 'bg-surface text-ink shadow-card'
              : 'text-muted hover:text-ink'
          }`}
          key={option.id}
          onClick={() => onChange(option.id)}
          role="radio"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function CronScheduleFields({
  onChange,
  value,
}: Readonly<{ onChange: (value: CronDraft) => void; value: CronDraft }>) {
  const error = validateCronSchedule(value.expression, value.timezone)
  const zones = listTimeZones()
  const occurrences = previewCronOccurrences(
    value.expression,
    value.timezone,
    PREVIEW_COUNT,
  )
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: value.timezone,
  })

  return (
    <div className="space-y-4">
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          htmlFor="cron-expression"
        >
          Expression cron
        </label>
        <Input
          aria-describedby="cron-expression-help"
          aria-invalid={Boolean(error)}
          classNames={{ input: 'font-mono' }}
          id="cron-expression"
          isInvalid={Boolean(error)}
          onValueChange={(expression) => onChange({ ...value, expression })}
          placeholder="0 3 * * *"
          radius="md"
          validationBehavior="aria"
          value={value.expression}
        />
        <p
          className="mt-2 text-xs leading-5 text-muted"
          id="cron-expression-help"
        >
          Minute, heure, jour du mois, mois, jour de la semaine. Les alias
          (@daily, @hourly) et les noms (MON, JAN) sont acceptés.
        </p>
        {error ? (
          <p className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {CRON_PRESETS.map((preset) => (
            <button
              className="min-h-8 rounded-md border border-line px-2.5 text-xs text-muted hover:border-action hover:text-ink"
              key={preset.expression}
              onClick={() =>
                onChange({ ...value, expression: preset.expression })
              }
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-2 block font-medium">Fuseau horaire</span>
        <select
          className="min-h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm outline-none focus:border-action"
          onChange={(event) =>
            onChange({ ...value, timezone: event.target.value })
          }
          value={value.timezone}
        >
          {(zones.includes(value.timezone)
            ? zones
            : [value.timezone, ...zones]
          ).map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>

      {occurrences.length > 0 ? (
        <div className="rounded-lg bg-canvas p-3">
          <p className="text-xs font-medium text-muted">
            Prochaines exécutions attendues
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {occurrences.map((occurrence) => (
              <li key={occurrence}>{formatter.format(occurrence)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
