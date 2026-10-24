import { Input, Select, SelectItem } from '@heroui/react'
import { useId, useState } from 'react'

export type DurationPreset = Readonly<{ label: string; minutes: number }>

const UNITS = [
  ['1', 'minutes'],
  ['60', 'heures'],
  ['1440', 'jours'],
] as const

function splitCustom(minutes: number): { amount: number; unit: string } {
  if (minutes > 0 && minutes % 1_440 === 0) {
    return { amount: minutes / 1_440, unit: '1440' }
  }
  if (minutes > 0 && minutes % 60 === 0) {
    return { amount: minutes / 60, unit: '60' }
  }

  return { amount: minutes, unit: '1' }
}

export function DurationPicker({
  description,
  error,
  label,
  onChange,
  presets,
  value,
}: Readonly<{
  description: string
  error?: string | undefined
  label: string
  onChange: (minutes: number) => void
  presets: readonly DurationPreset[]
  value: number
}>) {
  const labelId = useId()
  const isPreset = presets.some((preset) => preset.minutes === value)
  const [customMode, setCustomMode] = useState(!isPreset)
  const [custom, setCustom] = useState(() => splitCustom(value))
  const showCustom = customMode || !isPreset

  function updateCustom(amount: number, unit: string) {
    setCustom({ amount, unit })
    onChange(amount * Number(unit))
  }

  return (
    <div role="group" aria-labelledby={labelId}>
      <p className="mb-2 text-sm font-medium" id={labelId}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const isActive = !showCustom && preset.minutes === value

          return (
            <button
              aria-pressed={isActive}
              className={`min-h-10 rounded-lg border px-3.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-action bg-action-soft text-action'
                  : 'border-line bg-surface text-ink hover:border-border-strong'
              }`}
              key={preset.minutes}
              onClick={() => {
                setCustomMode(false)
                onChange(preset.minutes)
              }}
              type="button"
            >
              {preset.label}
            </button>
          )
        })}
        <button
          aria-pressed={showCustom}
          className={`min-h-10 rounded-lg border px-3.5 text-sm font-medium transition-colors ${
            showCustom
              ? 'border-action bg-action-soft text-action'
              : 'border-line bg-surface text-ink hover:border-border-strong'
          }`}
          onClick={() => {
            setCustomMode(true)
            updateCustom(custom.amount, custom.unit)
          }}
          type="button"
        >
          Personnalisé
        </button>
      </div>

      {showCustom ? (
        <div className="mt-3 grid max-w-sm grid-cols-[1fr_9rem] gap-3">
          <Input
            aria-label={`${label} : valeur personnalisée`}
            isInvalid={Boolean(error)}
            min={0}
            onValueChange={(next) =>
              updateCustom(Math.max(0, Number(next) || 0), custom.unit)
            }
            radius="md"
            type="number"
            value={String(custom.amount)}
          />
          <Select
            aria-label={`${label} : unité`}
            onSelectionChange={(keys) => {
              const unit = [...keys][0]

              if (unit !== undefined) {
                updateCustom(custom.amount, String(unit))
              }
            }}
            radius="md"
            selectedKeys={[custom.unit]}
          >
            {UNITS.map(([unit, unitLabel]) => (
              <SelectItem key={unit}>{unitLabel}</SelectItem>
            ))}
          </Select>
        </div>
      ) : null}

      <p className="mt-2 text-xs leading-5 text-muted">{description}</p>
      {error ? (
        <p className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
