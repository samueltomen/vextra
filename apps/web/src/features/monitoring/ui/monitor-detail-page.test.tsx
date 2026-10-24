import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderApp } from '../../../test/render-app.tsx'

describe('MonitorDetailPage', () => {
  it('shows a late monitor with its heartbeat command', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    await renderApp('/monitors/sync-stripe')

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Synchronisation Stripe',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Heartbeat attendu mais non reçu'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Authorization: Bearer \$CRONPING_TOKEN/),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copier la commande' }))
    expect(
      await screen.findByRole('button', { name: 'Commande copiée' }),
    ).toBeInTheDocument()
    expect(writeText).toHaveBeenCalled()
  })

  it('shows a healthy monitor without an open incident', async () => {
    await renderApp('/monitors/backup-postgres')

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Sauvegarde PostgreSQL',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Aucun incident récent pour ce moniteur.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Heartbeat attendu mais non reçu')).toBeNull()
  })

  it('shows a safe not-found state', async () => {
    await renderApp('/monitors/unknown')

    expect(
      await screen.findByRole('heading', { name: 'Moniteur introuvable' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retour au dashboard' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Moniteurs' }),
    ).toBeInTheDocument()
  })
})
