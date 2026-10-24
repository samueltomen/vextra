import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '../../../test/render-app.tsx'

describe('LoginPage', () => {
  it('redirects an unauthenticated dashboard visitor to the login form', async () => {
    await renderApp('/', { authenticated: false })

    expect(
      await screen.findByRole('heading', {
        name: 'Accéder à vos moniteurs',
      }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Adresse e-mail')).toHaveAttribute(
      'autocomplete',
      'email',
    )
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
  })

  it('signs in and opens the dashboard', async () => {
    await renderApp('/login', { authenticated: false })

    fireEvent.change(await screen.findByLabelText('Adresse e-mail'), {
      target: { value: 'alice@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'correct horse battery staple' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Moniteurs' }),
    ).toBeInTheDocument()
    expect(screen.getByText('alice@example.test')).toBeInTheDocument()
  })

  it('shows a safe credentials error', async () => {
    await renderApp('/login', {
      authenticated: false,
      loginStatus: 401,
    })

    fireEvent.change(await screen.findByLabelText('Adresse e-mail'), {
      target: { value: 'alice@example.test' },
    })
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'wrong password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(
      await screen.findByText('Adresse e-mail ou mot de passe incorrect.'),
    ).toBeInTheDocument()
  })

  it('validates signup fields and exposes accessible errors', async () => {
    await renderApp('/login', { authenticated: false })

    fireEvent.click(await screen.findByRole('button', { name: 'Inscription' }))
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(
      await screen.findByText('Saisissez une adresse e-mail valide.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Utilisez au moins 12 caractères.'),
    ).toBeInTheDocument()
  })
})
