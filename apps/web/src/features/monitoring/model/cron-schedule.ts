import {
  InvalidCronError,
  isSupportedTimeZone,
  nextCronOccurrence,
  parseCronExpression,
  upcomingCronOccurrences,
} from '@vextra/domain'

import { formatFrequency } from './monitor-format.ts'

export type CronPreset = Readonly<{ expression: string; label: string }>

export const CRON_PRESETS: readonly CronPreset[] = [
  { expression: '*/5 * * * *', label: 'Toutes les 5 min' },
  { expression: '0 * * * *', label: 'Chaque heure' },
  { expression: '0 3 * * *', label: 'Chaque jour à 03:00' },
  { expression: '0 9 * * 1-5', label: 'Jours ouvrés à 09:00' },
  { expression: '0 3 * * 1', label: 'Lundi à 03:00' },
  { expression: '0 0 1 * *', label: 'Le 1er du mois' },
]

export function validateCronSchedule(
  expression: string,
  timezone: string,
): string | undefined {
  if (expression.trim().length === 0) {
    return 'Saisissez une expression cron.'
  }

  if (!isSupportedTimeZone(timezone)) {
    return 'Ce fuseau horaire n’est pas reconnu.'
  }

  try {
    const schedule = parseCronExpression(expression)

    return nextCronOccurrence(schedule, Date.now(), timezone) === null
      ? 'Cette expression ne se déclenche jamais.'
      : undefined
  } catch (error) {
    if (error instanceof InvalidCronError) {
      return 'Expression cron invalide (5 champs : minute heure jour mois semaine).'
    }

    throw error
  }
}

export function previewCronOccurrences(
  expression: string,
  timezone: string,
  count: number,
  fromMs: number = Date.now(),
): readonly number[] {
  if (validateCronSchedule(expression, timezone) !== undefined) {
    return []
  }

  return upcomingCronOccurrences(
    parseCronExpression(expression),
    fromMs,
    timezone,
    count,
  )
}

export function describeSchedule(
  monitor: Readonly<{
    cronExpression: string | null
    cronTimezone: string | null
    intervalMinutes: number
  }>,
): string {
  return monitor.cronExpression
    ? `${monitor.cronExpression} (${monitor.cronTimezone ?? 'UTC'})`
    : formatFrequency(monitor.intervalMinutes)
}
