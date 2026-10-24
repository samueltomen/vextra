import type { DurationPreset } from './duration-picker.tsx'

export const MAX_INTERVAL_MINUTES = 525_600
export const MAX_GRACE_MINUTES = 10_080

export const INTERVAL_PRESETS: readonly DurationPreset[] = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 heure', minutes: 60 },
  { label: '6 heures', minutes: 360 },
  { label: '1 jour', minutes: 1_440 },
  { label: '1 semaine', minutes: 10_080 },
]

export const GRACE_PRESETS: readonly DurationPreset[] = [
  { label: '1 min', minutes: 1 },
  { label: '2 min', minutes: 2 },
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '1 heure', minutes: 60 },
]

export function validateInterval(minutes: number): string | undefined {
  if (minutes < 1) {
    return 'La fréquence doit être d’au moins 1 minute.'
  }

  return minutes > MAX_INTERVAL_MINUTES
    ? 'La fréquence ne peut pas dépasser 1 an.'
    : undefined
}

export function validateGrace(minutes: number): string | undefined {
  if (minutes < 0) {
    return 'La marge ne peut pas être négative.'
  }

  return minutes > MAX_GRACE_MINUTES
    ? 'La marge ne peut pas dépasser 7 jours.'
    : undefined
}
