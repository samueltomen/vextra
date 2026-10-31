import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderApp } from '../../../test/render-app.tsx'

describe('ApiKeysCard', () => {
  it('creates a key, shows the secret once and revokes it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    await renderApp('/settings')

    const create = await screen.findByRole('button', { name: 'Créer une clé' })

    expect(create).toBeDisabled()
    expect(screen.getByText('Aucune clé d’API.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nom de la clé'), {
      target: { value: 'CI' },
    })
    fireEvent.click(create)

    expect(
      await screen.findByText(/ne\s+sera plus affichée/),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/vx_test-secret/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Copier la clé' }))
    expect(
      await screen.findByRole('button', { name: 'Clé copiée' }),
    ).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('vx_test-secret'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Révoquer la clé CI' }))
    expect(await screen.findByText('Révoquée')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Révoquer la clé CI' }),
    ).not.toBeInTheDocument()
  })

  it('reports the active key limit', async () => {
    await renderApp('/settings')

    fireEvent.change(await screen.findByLabelText('Nom de la clé'), {
      target: { value: 'limite' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Créer une clé' }))

    expect(
      await screen.findByText(/Limite de 10 clés actives atteinte/),
    ).toBeInTheDocument()
  })
})
