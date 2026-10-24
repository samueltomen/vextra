import { Monitor, Moon, Sun } from 'lucide-react'

import {
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from './theme.ts'

const OPTIONS = [
  { icon: Sun, label: 'Thème clair', value: 'light' },
  { icon: Monitor, label: 'Thème du système', value: 'system' },
  { icon: Moon, label: 'Thème sombre', value: 'dark' },
] as const satisfies readonly {
  icon: typeof Sun
  label: string
  value: ThemePreference
}[]

export function ThemeToggle() {
  const preference = useThemePreference()

  return (
    <div
      aria-label="Apparence"
      className="grid grid-cols-3 gap-1 rounded-lg border border-sidebar-line bg-sidebar p-1"
      role="group"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const isActive = preference === option.value

        return (
          <button
            aria-label={option.label}
            aria-pressed={isActive}
            className={`grid min-h-8 place-items-center rounded-md transition-colors ${
              isActive
                ? 'bg-sidebar-active text-sidebar-accent'
                : 'text-sidebar-muted hover:text-sidebar-ink'
            }`}
            key={option.value}
            onClick={() => setThemePreference(option.value)}
            type="button"
          >
            <Icon aria-hidden="true" size={15} />
          </button>
        )
      })}
    </div>
  )
}

export function ThemeCycleButton() {
  const preference = useThemePreference()
  const order: readonly ThemePreference[] = ['light', 'dark', 'system']
  const next = order[(order.indexOf(preference) + 1) % order.length] ?? 'system'
  const Icon =
    preference === 'dark' ? Moon : preference === 'light' ? Sun : Monitor

  return (
    <button
      aria-label="Changer l’apparence"
      className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
      onClick={() => setThemePreference(next)}
      type="button"
    >
      <Icon aria-hidden="true" size={19} />
    </button>
  )
}
