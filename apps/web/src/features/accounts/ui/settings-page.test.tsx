import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '../../../test/render-app.tsx'

describe('SettingsPage', () => {
  it('shows account and notification information', async () => {
    await renderApp('/settings')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Réglages' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('alice@example.test').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('link', { name: 'Consulter les envois' }),
    ).toBeInTheDocument()
  })

  it('requires explicit confirmation before deleting the account', async () => {
    await renderApp('/settings')

    const confirmation = await screen.findByLabelText(
      'Saisissez SUPPRIMER pour confirmer',
    )
    const deleteButton = screen.getByRole('button', {
      name: 'Supprimer définitivement',
    })

    expect(deleteButton).toBeDisabled()
    fireEvent.change(confirmation, { target: { value: 'SUPPRIMER' } })
    expect(deleteButton).toBeEnabled()
    fireEvent.click(deleteButton)

    expect(
      await screen.findByRole('heading', { name: 'Accéder à vos moniteurs' }),
    ).toBeInTheDocument()
  })
})
