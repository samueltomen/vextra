import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '../../../test/render-app.tsx'

describe('NotificationsPage', () => {
  it('shows the email recipient and delivery history', async () => {
    await renderApp('/notifications')

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Notifications',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('alice@example.test').length).toBeGreaterThan(0)
    expect(
      await screen.findByText('Synchronisation Stripe'),
    ).toBeInTheDocument()
    expect(screen.getByText('Sauvegarde PostgreSQL')).toBeInTheDocument()
    expect(screen.getByText('Envoyé')).toBeInTheDocument()
    expect(screen.getByText('Nouvelle tentative')).toBeInTheDocument()
  })

  it('is reachable from the application navigation', async () => {
    await renderApp('/')

    fireEvent.click(await screen.findByRole('link', { name: 'Notifications' }))
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Notifications',
      }),
    ).toBeInTheDocument()
  })
})
