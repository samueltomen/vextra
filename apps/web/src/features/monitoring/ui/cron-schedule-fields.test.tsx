import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  CronScheduleFields,
  ScheduleKindToggle,
} from './cron-schedule-fields.tsx'

describe('ScheduleKindToggle', () => {
  it('switches between interval and cron', () => {
    const onChange = vi.fn()

    render(<ScheduleKindToggle onChange={onChange} value="interval" />)
    fireEvent.click(screen.getByRole('radio', { name: 'Expression cron' }))

    expect(onChange).toHaveBeenCalledWith('cron')
    expect(
      screen
        .getByRole('radio', { name: 'Intervalle' })
        .getAttribute('aria-checked'),
    ).toBe('true')
  })
})

describe('CronScheduleFields', () => {
  it('previews the next occurrences of a valid expression', () => {
    render(
      <CronScheduleFields
        onChange={() => undefined}
        value={{ expression: '0 3 * * *', timezone: 'Europe/Paris' }}
      />,
    )

    expect(screen.getByText('Prochaines exécutions attendues')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reports an invalid expression instead of a preview', () => {
    render(
      <CronScheduleFields
        onChange={() => undefined}
        value={{ expression: 'nope', timezone: 'UTC' }}
      />,
    )

    expect(screen.getByRole('alert').textContent).toMatch(/invalide/i)
    expect(screen.queryByText('Prochaines exécutions attendues')).toBeNull()
  })

  it('applies a preset and a time zone change', () => {
    const onChange = vi.fn()

    render(
      <CronScheduleFields
        onChange={onChange}
        value={{ expression: '0 3 * * *', timezone: 'UTC' }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Lundi à 03:00' }))
    expect(onChange).toHaveBeenCalledWith({
      expression: '0 3 * * 1',
      timezone: 'UTC',
    })

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Europe/Paris' },
    })
    expect(onChange).toHaveBeenCalledWith({
      expression: '0 3 * * *',
      timezone: 'Europe/Paris',
    })
  })
})
