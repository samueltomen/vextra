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
    await renderApp('/monitors/20000000-0000-4000-8000-000000000002')

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Synchronisation Stripe',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Heartbeat attendu mais non reçu'),
    ).toBeInTheDocument()
    expect(screen.getByText('Heartbeat manquant')).toBeInTheDocument()
    expect(screen.getByText('Alertes e-mail')).toBeInTheDocument()
    expect(screen.getAllByText('alice@example.test')).toHaveLength(2)
    expect(
      screen.getByText(/Authorization: Bearer \$CRONPING_TOKEN/),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copier la commande' }))
    expect(
      await screen.findByRole('button', { name: 'Commande copiée' }),
    ).toBeInTheDocument()
    expect(writeText).toHaveBeenCalled()
  })

  it('pauses and resumes a monitor from the detail page', async () => {
    await renderApp('/monitors/20000000-0000-4000-8000-000000000002')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Mettre en pause' }),
    )
    expect(
      await screen.findByRole('button', {
        name: 'Reprendre la surveillance',
      }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Reprendre la surveillance' }),
    )
    expect(
      await screen.findByRole('button', { name: 'Mettre en pause' }),
    ).toBeInTheDocument()
  })

  it('deletes a monitor after explicit confirmation', async () => {
    await renderApp('/monitors/20000000-0000-4000-8000-000000000002')

    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Moniteurs' }),
    ).toBeInTheDocument()
  })

  it('rotates the heartbeat token and reveals it once', async () => {
    await renderApp('/monitors/20000000-0000-4000-8000-000000000001')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Renouveler le token' }),
    )

    expect(
      await screen.findByText('Nouveau token affiché une fois'),
    ).toBeInTheDocument()
    expect(screen.getByText('cp_rotated-heartbeat-token')).toBeInTheDocument()
    expect(
      screen.getByText(/ancien token est maintenant invalide/i),
    ).toBeInTheDocument()
  })

  it('shows a healthy monitor without an open incident', async () => {
    await renderApp('/monitors/20000000-0000-4000-8000-000000000001')

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

  it('edits the schedule of a monitor and shows the new configuration', async () => {
    await renderApp('/monitors/20000000-0000-4000-8000-000000000001')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Modifier la planification' }),
    )

    const save = screen.getByRole('button', {
      name: 'Enregistrer la planification',
    })
    expect(save).toBeDisabled()

    fireEvent.click(screen.getAllByRole('button', { name: '15 min' })[0]!)
    expect(save).toBeEnabled()
    fireEvent.click(save)

    expect(
      await screen.findByRole('button', { name: 'Modifier la planification' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Toutes les 15 minutes')).toBeInTheDocument()
  })

  it('switches a monitor to a cron schedule and shows the expression', async () => {
    await renderApp('/monitors/20000000-0000-4000-8000-000000000001')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Modifier la planification' }),
    )
    fireEvent.click(screen.getByRole('radio', { name: 'Expression cron' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Jours ouvrés à 09:00' }),
    )

    const save = screen.getByRole('button', {
      name: 'Enregistrer la planification',
    })

    expect(save).toBeEnabled()
    fireEvent.click(save)

    expect(await screen.findByText(/^0 9 \* \* 1-5 \(/)).toBeInTheDocument()
    expect(screen.getByText('Planification')).toBeInTheDocument()
  })

  it('cancels a schedule edit without saving it', async () => {
    await renderApp('/monitors/20000000-0000-4000-8000-000000000001')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Modifier la planification' }),
    )
    fireEvent.click(screen.getAllByRole('button', { name: '15 min' })[0]!)
    fireEvent.click(
      screen.getByRole('button', { name: 'Annuler la modification' }),
    )

    expect(screen.getByText('Tous les jours')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Enregistrer la planification' }),
    ).toBeNull()
  })

  it('shows a safe not-found state', async () => {
    await renderApp('/monitors/20000000-0000-4000-8000-000000000099')

    expect(
      await screen.findByRole('heading', { name: 'Moniteur introuvable' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retour au dashboard' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Moniteurs' }),
    ).toBeInTheDocument()
  })
})
