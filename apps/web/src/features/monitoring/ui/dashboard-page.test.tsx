import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '../../../test/render-app.tsx'

describe('DashboardPage', () => {
  it('shows monitor health and the primary creation action', async () => {
    await renderApp('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Moniteurs' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /créer un moniteur/i }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('link', {
        name: 'Sauvegarde PostgreSQL, Opérationnel',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Synchronisation Stripe')).toBeInTheDocument()
  })

  it('renders a stable loading state', async () => {
    await renderApp('/?state=loading')

    expect(
      await screen.findByLabelText('Chargement des moniteurs'),
    ).toBeInTheDocument()
  })

  it('renders an actionable empty state', async () => {
    await renderApp('/?state=empty')

    expect(
      await screen.findByText('Aucun moniteur dans cette vue'),
    ).toBeInTheDocument()
  })

  it('renders a recoverable error state', async () => {
    await renderApp('/?state=error')

    expect(
      await screen.findByText('Impossible de charger les moniteurs.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Réessayer' }),
    ).toBeInTheDocument()
  })

  it('filters the list and navigates to monitor creation', async () => {
    await renderApp('/')

    await screen.findByText('Sauvegarde PostgreSQL')
    fireEvent.click(screen.getByRole('button', { name: 'En retard 1' }))

    expect(screen.queryByText('Sauvegarde PostgreSQL')).not.toBeInTheDocument()
    expect(screen.getByText('Synchronisation Stripe')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: /créer un moniteur/i }))
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Ajouter un heartbeat',
      }),
    ).toBeInTheDocument()
  })
})
