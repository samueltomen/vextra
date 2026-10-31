import { describe, expect, it } from 'vitest'

import {
  CRON_PRESETS,
  describeSchedule,
  previewCronOccurrences,
  validateCronSchedule,
} from './cron-schedule.ts'

describe('validateCronSchedule', () => {
  it('accepts a valid expression with a supported time zone', () => {
    expect(validateCronSchedule('0 3 * * *', 'Europe/Paris')).toBeUndefined()
  })

  it('explains an invalid expression or time zone', () => {
    expect(validateCronSchedule('', 'UTC')).toMatch(/expression/i)
    expect(validateCronSchedule('not cron', 'UTC')).toMatch(/invalide/i)
    expect(validateCronSchedule('0 3 * * *', 'Mars/Olympus')).toMatch(/fuseau/i)
  })

  it('rejects a schedule that never fires', () => {
    expect(validateCronSchedule('0 0 31 2 *', 'UTC')).toMatch(/jamais/i)
  })

  it('keeps every preset valid', () => {
    for (const preset of CRON_PRESETS) {
      expect(validateCronSchedule(preset.expression, 'UTC')).toBeUndefined()
    }
  })
})

describe('previewCronOccurrences', () => {
  it('lists the next occurrences in order', () => {
    const from = Date.parse('2026-10-31T12:00:00.000Z')

    expect(previewCronOccurrences('0 3 * * *', 'UTC', 3, from)).toEqual([
      Date.parse('2026-11-01T03:00:00.000Z'),
      Date.parse('2026-11-02T03:00:00.000Z'),
      Date.parse('2026-11-03T03:00:00.000Z'),
    ])
  })

  it('returns nothing for an invalid schedule', () => {
    expect(previewCronOccurrences('nope', 'UTC', 3, 0)).toEqual([])
  })
})

describe('describeSchedule', () => {
  it('shows the cron expression and its zone, or the frequency', () => {
    expect(
      describeSchedule({
        cronExpression: '0 3 * * *',
        cronTimezone: 'Europe/Paris',
        intervalMinutes: 1_500,
      }),
    ).toBe('0 3 * * * (Europe/Paris)')
    expect(
      describeSchedule({
        cronExpression: null,
        cronTimezone: null,
        intervalMinutes: 15,
      }),
    ).toBe('Toutes les 15 minutes')
  })
})
