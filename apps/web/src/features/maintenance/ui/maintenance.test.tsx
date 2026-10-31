import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '../../../test/render-app.tsx'

async function openCard() {
  await renderApp('/settings')

  return screen.findByRole('button', { name: 'Planifier la maintenance' })
}

describe('MaintenanceCard', () => {
  it('plans a window for all monitors and deletes it', async () => {
    const plan = await openCard()

    expect(plan).toBeDisabled()
    expect(
      screen.getByText('Aucune fenêtre de maintenance planifiée.'),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nom'), {
      target: { value: 'Migration base' },
    })
    expect(plan).toBeEnabled()
    fireEvent.click(plan)

    expect(await screen.findByText('Migration base')).toBeInTheDocument()
    expect(screen.getByText('En cours')).toBeInTheDocument()
    expect(screen.getByText(/→.*Tous les moniteurs/)).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Supprimer la fenêtre Migration base',
      }),
    )
    expect(
      await screen.findByText('Aucune fenêtre de maintenance planifiée.'),
    ).toBeInTheDocument()
  })

  it('reports the window limit', async () => {
    const plan = await openCard()

    fireEvent.change(screen.getByLabelText('Nom'), {
      target: { value: 'limite' },
    })
    fireEvent.click(plan)

    expect(
      await screen.findByText('Limite de 100 fenêtres à venir atteinte.'),
    ).toBeInTheDocument()
  })
})
