import { useSyncExternalStore } from 'react'

export type ThemePreference = 'dark' | 'light' | 'system'

const THEME_STORAGE_KEY = 'vextra.theme'
const listeners = new Set<() => void>()

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system'
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)

    return isThemePreference(stored) ? stored : 'dark'
  } catch {
    return 'dark'
  }
}

function prefersDark(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function resolveTheme(
  preference: ThemePreference,
): Exclude<ThemePreference, 'system'> {
  if (preference === 'system') {
    return prefersDark() ? 'dark' : 'light'
  }

  return preference
}

export function applyTheme(preference: ThemePreference): void {
  document.documentElement.classList.toggle(
    'dark',
    resolveTheme(preference) === 'dark',
  )
}

let currentPreference = readThemePreference()

export function setThemePreference(preference: ThemePreference): void {
  currentPreference = preference

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Le thème reste appliqué pour la session si le stockage est indisponible.
  }

  applyTheme(preference)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (currentPreference === 'system') {
        applyTheme('system')
      }
    })
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribe,
    () => currentPreference,
    () => 'dark',
  )
}
