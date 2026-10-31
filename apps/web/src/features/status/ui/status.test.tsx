import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '../../../test/render-app.tsx'

describe('PublicStatusPage', () => {
  it('shows the services and incidents without the application shell', async () => {
    await renderApp('/status/acme-status', { authenticated: false })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Acme' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Certains services rencontrent un incident'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('API publique').length).toBeGreaterThan(0)
    expect(screen.getByText(/99,50 % sur 30 jours/)).toBeInTheDocument()
    expect(screen.queryByText('Rechercher…')).not.toBeInTheDocument()
  })

  it('explains that an unknown page does not exist', async () => {
    await renderApp('/status/inconnue', { authenticated: false })

    expect(
      await screen.findByRole('heading', {
        name: 'Page de statut introuvable',
      }),
    ).toBeInTheDocument()
  })
})

describe('StatusPageCard', () => {
  async function openCard() {
    await renderApp('/settings')

    return screen.findByRole('button', {
      name: 'Enregistrer la page de statut',
    })
  }

  it('publishes a page with the selected monitors', async () => {
    const save = await openCard()

    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Titre'), {
      target: { value: 'Statut Acme' },
    })
    fireEvent.change(screen.getByLabelText('Adresse'), {
      target: { value: 'Acme-Status' },
    })
    fireEvent.click(
      (await screen.findAllByRole('checkbox', { name: /Sauvegarde/ }))[0]!,
    )
    expect(save).toBeEnabled()
    fireEvent.click(save)

    expect(
      await screen.findByRole('link', { name: 'Ouvrir la page publique' }),
    ).toHaveAttribute('href', expect.stringContaining('/status/acme-status'))
  })

  it('reports an address that is already taken', async () => {
    const save = await openCard()

    fireEvent.change(screen.getByLabelText('Titre'), {
      target: { value: 'Statut' },
    })
    fireEvent.change(screen.getByLabelText('Adresse'), {
      target: { value: 'pris' },
    })
    fireEvent.click(save)

    expect(
      await screen.findByText(/Cette adresse est déjà utilisée/),
    ).toBeInTheDocument()
  })
})
