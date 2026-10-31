import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { DurationPicker } from './duration-picker.tsx'
import { INTERVAL_PRESETS } from './schedule-presets.ts'

function Harness({ initial, error }: { initial: number; error?: string }) {
  const [value, setValue] = useState(initial)

  return (
    <>
      <DurationPicker
        description="aide"
        error={error}
        label="Fréquence"
        onChange={setValue}
        presets={INTERVAL_PRESETS}
        value={value}
      />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('DurationPicker', () => {
  it('selects a preset', () => {
    render(<Harness initial={5} />)

    fireEvent.click(screen.getByRole('button', { name: '1 heure' }))

    expect(screen.getByTestId('value')).toHaveTextContent('60')
    expect(screen.getByRole('button', { name: '1 heure' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('opens custom mode and converts the amount to minutes', () => {
    render(<Harness initial={5} />)

    fireEvent.click(screen.getByRole('button', { name: 'Personnalisé' }))
    fireEvent.change(
      screen.getByLabelText('Fréquence : valeur personnalisée'),
      { target: { value: '7' } },
    )

    expect(screen.getByTestId('value')).toHaveTextContent('7')
  })

  it('starts in custom mode with the best unit for a non-preset value', () => {
    render(<Harness initial={2_880} />)

    expect(
      screen.getByLabelText('Fréquence : valeur personnalisée'),
    ).toHaveValue(2)
  })

  it('uses hours when the value is a multiple of 60', () => {
    render(<Harness initial={180} />)

    expect(
      screen.getByLabelText('Fréquence : valeur personnalisée'),
    ).toHaveValue(3)
  })

  it('displays an error message', () => {
    render(<Harness error="Trop long" initial={5} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Trop long')
  })
})
