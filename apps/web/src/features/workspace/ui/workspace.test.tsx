import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TEST_FOLDER_ID } from '../../../test/api-mock.ts'
import { renderApp } from '../../../test/render-app.tsx'

const MONITOR_ID = '20000000-0000-4000-8000-000000000001'

function monitorsWithFolder() {
  const base = Date.now()

  return [
    {
      alertAt: new Date(base + 3_600_000).toISOString(),
      createdAt: new Date(base - 86_400_000).toISOString(),
      folderId: TEST_FOLDER_ID,
      graceSeconds: 1_800,
      id: MONITOR_ID,
      incidentOpenedAt: null,
      intervalSeconds: 86_400,
      lastHeartbeatAt: new Date(base - 600_000).toISOString(),
      pausedAt: null,
      status: 'healthy' as const,
      totalPings: 5,
    },
    {
      alertAt: new Date(base + 3_600_000).toISOString(),
      createdAt: new Date(base - 86_400_000).toISOString(),
      folderId: null,
      graceSeconds: 1_800,
      id: '20000000-0000-4000-8000-000000000004',
      incidentOpenedAt: null,
      intervalSeconds: 86_400,
      lastHeartbeatAt: null,
      pausedAt: null,
      status: 'pending' as const,
      totalPings: 0,
    },
  ]
}

describe('folders', () => {
  it('filters the dashboard by folder and by unfiled monitors', async () => {
    await renderApp('/', { monitors: monitorsWithFolder() })

    const production = await screen.findByRole('button', {
      name: 'Production 1',
    })

    fireEvent.click(production)
    expect(await screen.findByText('Sauvegarde PostgreSQL')).toBeInTheDocument()
    expect(screen.queryByText('Nettoyage des médias')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sans dossier 1' }))
    expect(await screen.findByText('Nettoyage des médias')).toBeInTheDocument()
    expect(screen.queryByText('Sauvegarde PostgreSQL')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tous 2' }))
    expect(await screen.findByText('Sauvegarde PostgreSQL')).toBeInTheDocument()
  })

  it('creates, renames and deletes folders', async () => {
    await renderApp('/', { monitors: monitorsWithFolder() })

    fireEvent.click(
      await screen.findByRole('button', { name: /Gérer les dossiers/ }),
    )
    fireEvent.change(screen.getByLabelText('Nom du nouveau dossier'), {
      target: { value: 'Staging' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(
      await screen.findByRole('button', { name: 'Staging 0' }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nom du nouveau dossier'), {
      target: { value: 'Staging' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('déjà utilisé')

    const rename = screen.getByLabelText('Renommer Staging')

    fireEvent.change(rename, { target: { value: 'Recette' } })
    fireEvent.blur(rename)
    expect(
      await screen.findByRole('button', { name: 'Recette 0' }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Supprimer le dossier Recette' }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Recette 0' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('moves a monitor to another folder from its detail page', async () => {
    await renderApp(`/monitors/${MONITOR_ID}`, {
      monitors: monitorsWithFolder(),
    })

    const select = await screen.findByLabelText('Dossier du moniteur')

    expect(select).toHaveValue(TEST_FOLDER_ID)
    fireEvent.change(select, { target: { value: '' } })
    await waitFor(() => expect(select).toHaveValue(''))
  })
})

describe('monitor metrics', () => {
  it('shows heartbeat counters on the monitor page', async () => {
    await renderApp(`/monitors/${MONITOR_ID}`, {
      monitors: monitorsWithFolder(),
    })

    const panel = await screen.findByRole('region', {
      name: 'Activité des heartbeats',
    })

    expect(await within(panel).findByText('42')).toBeInTheDocument()
    expect(within(panel).getByText('Intervalle moyen')).toBeInTheDocument()
    expect(within(panel).getAllByText('60 min').length).toBeGreaterThan(0)
    expect(
      within(panel).getByRole('img', {
        name: 'Heartbeats reçus par jour sur 30 jours',
      }),
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole('img', {
        name: 'Intervalle moyen entre heartbeats sur 30 jours',
      }),
    ).toBeInTheDocument()
  })
})

describe('preferences', () => {
  it('saves display name, time zone and alert preferences', async () => {
    const { fetchMock } = await renderAppWithMock()

    fireEvent.change(await screen.findByLabelText('Nom affiché'), {
      target: { value: 'Ada' },
    })
    fireEvent.change(screen.getByLabelText('Fuseau horaire'), {
      target: { value: 'Asia/Tokyo' },
    })
    fireEvent.click(screen.getByLabelText(/Incident résolu/))
    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer les préférences' }),
    )

    expect(await screen.findByText('Préférences enregistrées.')).toBeVisible()

    const patch = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'PATCH',
    )

    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
      displayName: 'Ada',
      notifyOnOpen: true,
      notifyOnResolve: false,
      timezone: 'Asia/Tokyo',
    })
  })
})

async function renderAppWithMock() {
  const { installApiMock } = await import('../../../test/api-mock.ts')
  const mock = installApiMock

  void mock
  const result = await renderApp('/settings')
  const fetchMock = globalThis.fetch as unknown as import('vitest').Mock<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >

  return { ...result, fetchMock }
}
