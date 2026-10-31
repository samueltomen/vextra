import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderApp } from '../../../test/render-app.tsx'

describe('TeamCard', () => {
  it('lists members and lets the owner change a role', async () => {
    await renderApp('/settings')

    expect(await screen.findByText('bob@example.test')).toBeInTheDocument()
    expect(screen.getByText('(vous)')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Rôle de bob@example.test'), {
      target: { value: 'viewer' },
    })
    await waitFor(() =>
      expect(screen.getByLabelText('Rôle de bob@example.test')).toHaveValue(
        'viewer',
      ),
    )
  })

  it('removes a member', async () => {
    await renderApp('/settings')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Retirer bob@example.test' }),
    )
    await waitFor(() =>
      expect(screen.queryByText('bob@example.test')).not.toBeInTheDocument(),
    )
  })

  it('creates an invitation, shows the one-time link and revokes it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    await renderApp('/settings')

    const create = await screen.findByRole('button', {
      name: 'Créer l’invitation',
    })

    expect(create).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Adresse e-mail à inviter'), {
      target: { value: 'carol@example.test' },
    })
    fireEvent.click(create)

    expect(
      await screen.findByText(/Invitation créée pour carol@example.test/),
    ).toBeInTheDocument()
    expect(screen.getByText(/\/invite\/vxi_T+/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }))
    expect(
      await screen.findByRole('button', { name: 'Lien copié' }),
    ).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('/invite/vxi_'),
    )
    expect(
      await screen.findByText(/Invitations en attente/),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Annuler l’invitation de carol@example.test',
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByText(/Invitations en attente/),
      ).not.toBeInTheDocument(),
    )
  })

  it('reports an address that is already invited', async () => {
    await renderApp('/settings')

    fireEvent.change(await screen.findByLabelText('Adresse e-mail à inviter'), {
      target: { value: 'deja@example.test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Créer l’invitation' }))

    expect(
      await screen.findByText(/invitation est déjà en attente/),
    ).toBeInTheDocument()
  })
})

describe('read-only role', () => {
  it('shows the read-only notice, hides creation and offers to leave', async () => {
    await renderApp('/settings', { role: 'viewer' })

    expect(
      await screen.findByText(/Vous consultez cet espace en/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Nouveau moniteur' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Créer l’invitation' }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByRole('combobox', { name: /Espace actif/ }),
    ).toBeInTheDocument()
  })
})

describe('InvitePage', () => {
  it('joins the space of a valid invitation', async () => {
    await renderApp(`/invite/vxi_${'A'.repeat(43)}`)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Moniteurs' }),
    ).toBeInTheDocument()
  })

  it('explains an unusable invitation', async () => {
    await renderApp(`/invite/vxi_${'X'.repeat(43)}`)

    expect(
      await screen.findByRole('heading', { name: 'Invitation inutilisable' }),
    ).toBeInTheDocument()
  })

  it('asks anonymous visitors to sign in and remembers the invitation', async () => {
    const token = `vxi_${'B'.repeat(43)}`

    await renderApp(`/invite/${token}`, { authenticated: false })

    expect(
      await screen.findByRole('heading', { name: 'Vous êtes invité' }),
    ).toBeInTheDocument()
    expect(window.sessionStorage.getItem('vextra.pending-invite')).toBe(token)
  })
})
