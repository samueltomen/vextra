import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderApp } from '../../../test/render-app.tsx'

describe('CreateMonitorPage', () => {
  it('creates a local preview monitor and reveals the token once', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    await renderApp('/monitors/new')

    const labelInput = await screen.findByLabelText('Libellé local')
    fireEvent.change(labelInput, {
      target: { value: 'Sauvegarde test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le moniteur' }))

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Sauvegarde test',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Moniteur créé')).toBeInTheDocument()
    expect(screen.getByText(/Authorization: Bearer cp_/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copier la commande' }))
    expect(
      await screen.findByRole('button', { name: 'Commande copiée' }),
    ).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('Authorization: Bearer cp_'),
    )
  })

  it('validates the local label before submission', async () => {
    await renderApp('/monitors/new')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Créer le moniteur' }),
    )

    expect(
      await screen.findByText('Donnez un libellé à ce moniteur.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Ajouter un heartbeat' }),
    ).toBeInTheDocument()
  })

  it('shows the privacy guarantee and allows cancelling the form', async () => {
    await renderApp('/monitors/new')

    expect(
      await screen.findByText(
        'Aucun script, log ou commande cron ne sera enregistré.',
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Moniteurs' }),
    ).toBeInTheDocument()
  })

  it('creates a monitor driven by a cron expression', async () => {
    await renderApp('/monitors/new')

    fireEvent.change(await screen.findByLabelText('Libellé local'), {
      target: { value: 'Rapport nocturne' },
    })
    fireEvent.click(screen.getByRole('radio', { name: 'Expression cron' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Lundi à 03:00' }),
    )

    expect(screen.getByLabelText('Expression cron')).toHaveValue('0 3 * * 1')
    expect(
      screen.getByText('Prochaines exécutions attendues'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Créer le moniteur' }))

    expect(await screen.findByText('Moniteur créé')).toBeInTheDocument()
  })

  it('blocks the submission while the cron expression is invalid', async () => {
    await renderApp('/monitors/new')

    fireEvent.change(await screen.findByLabelText('Libellé local'), {
      target: { value: 'Rapport' },
    })
    fireEvent.click(screen.getByRole('radio', { name: 'Expression cron' }))
    fireEvent.change(await screen.findByLabelText('Expression cron'), {
      target: { value: 'pas du cron' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le moniteur' }))

    expect(
      await screen.findByText('Corrigez l’expression cron avant de continuer.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Moniteur créé')).not.toBeInTheDocument()
  })
})
