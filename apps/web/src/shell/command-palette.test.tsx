import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '../test/render-app.tsx'

async function openPalette() {
  await renderApp('/')
  const [trigger] = await screen.findAllByRole('button', {
    name: 'Ouvrir la recherche',
  })
  fireEvent.click(trigger!)

  return screen.findByPlaceholderText('Aller à… ou rechercher un moniteur')
}

describe('CommandPalette', () => {
  it('opens with Ctrl+K and lists pages and actions', async () => {
    await openPalette()

    expect(
      screen.getByRole('option', { name: /Nouveau moniteur/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /Se déconnecter/ }),
    ).toBeInTheDocument()
  })

  it('filters results and shows an empty state', async () => {
    const input = await openPalette()

    fireEvent.change(input, { target: { value: 'notif' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)

    fireEvent.change(input, { target: { value: 'zzzz' } })
    expect(screen.getByText(/Aucun résultat/)).toBeInTheDocument()
  })

  it('navigates with the keyboard and runs the selected item', async () => {
    const input = await openPalette()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'Ajouter un heartbeat',
        }),
      ).toBeInTheDocument(),
    )
  })

  it('runs an item on click and closes the palette', async () => {
    const input = await openPalette()

    fireEvent.change(input, { target: { value: 'réglages' } })
    fireEvent.mouseEnter(screen.getByRole('option'))
    fireEvent.click(screen.getByRole('option'))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Réglages' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText('Aller à… ou rechercher un moniteur'),
      ).not.toBeInTheDocument(),
    )
  })

  it('applies a theme action', async () => {
    const input = await openPalette()

    fireEvent.change(input, { target: { value: 'sombre' } })
    fireEvent.click(screen.getByRole('option'))

    await waitFor(() =>
      expect(document.documentElement.dataset['theme'] ?? 'dark').toBe('dark'),
    )
  })
})
