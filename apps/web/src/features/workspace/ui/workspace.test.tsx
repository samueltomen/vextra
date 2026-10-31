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
      alertsEnabled: true,
      description: null,
      createdAt: new Date(base - 86_400_000).toISOString(),
      cronExpression: null,
      cronTimezone: null,
      folderId: TEST_FOLDER_ID,
      graceSeconds: 1_800,
      id: MONITOR_ID,
      incidentOpenedAt: null,
      intervalSeconds: 86_400,
      lastHeartbeatAt: new Date(base - 600_000).toISOString(),
      name: null,
      notes: null,
      pausedAt: null,
      runningSince: null,
      status: 'healthy' as const,
      totalPings: 5,
    },
    {
      alertAt: new Date(base + 3_600_000).toISOString(),
      alertsEnabled: true,
      description: null,
      createdAt: new Date(base - 86_400_000).toISOString(),
      cronExpression: null,
      cronTimezone: null,
      folderId: null,
      graceSeconds: 1_800,
      id: '20000000-0000-4000-8000-000000000004',
      incidentOpenedAt: null,
      intervalSeconds: 86_400,
      lastHeartbeatAt: null,
      name: null,
      notes: null,
      pausedAt: null,
      runningSince: null,
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
    expect(
      within(panel).getByRole('img', {
        name: 'Durée d’exécution moyenne sur 30 jours',
      }),
    ).toBeInTheDocument()
    expect(within(panel).getByText('Échecs (30 j)')).toBeInTheDocument()
  })
})

describe('run history', () => {
  it('lists recent runs with their kind, duration and overlaps', async () => {
    await renderApp(`/monitors/${MONITOR_ID}`, {
      monitors: monitorsWithFolder(),
    })

    const panel = await screen.findByRole('region', {
      name: 'Historique des exécutions',
    })

    expect(await within(panel).findByText('Succès')).toBeInTheDocument()
    expect(within(panel).getByText('Début')).toBeInTheDocument()
    expect(within(panel).getByText('Chevauchement')).toBeInTheDocument()
    expect(within(panel).getByText('2,0 s')).toBeInTheDocument()
  })

  it('shows when a run is in progress', async () => {
    const [monitor, ...others] = monitorsWithFolder()

    await renderApp(`/monitors/${MONITOR_ID}`, {
      monitors: [
        { ...monitor!, runningSince: new Date().toISOString() },
        ...others,
      ],
    })

    expect(await screen.findByText('En cours d’exécution')).toBeInTheDocument()
  })
})

describe('alert channels', () => {
  async function openSettings() {
    await renderApp('/settings')

    return screen.findByRole('region', { name: 'Canaux d’alerte' })
  }

  async function addChannel(card: HTMLElement, name: string, target: string) {
    fireEvent.change(within(card).getByLabelText('Nom du canal'), {
      target: { value: name },
    })
    fireEvent.change(
      within(card).getByLabelText('URL du webhook entrant Slack'),
      {
        target: { value: target },
      },
    )
    fireEvent.click(
      within(card).getByRole('button', { name: 'Ajouter le canal' }),
    )
  }

  it('adds a channel, tests it, disables it and removes it', async () => {
    const card = await openSettings()

    expect(
      await within(card).findByText('Aucun canal configuré.'),
    ).toBeVisible()

    await addChannel(
      card,
      'Équipe ops',
      'https://hooks.slack.com/services/T/B/x',
    )
    expect(await within(card).findByText('Équipe ops')).toBeVisible()
    expect(within(card).getByText(/example\.com\/…hook/)).toBeVisible()
    expect(
      (
        within(card).getByLabelText(
          'URL du webhook entrant Slack',
        ) as HTMLInputElement
      ).value,
    ).toBe('')

    fireEvent.click(
      within(card).getByRole('button', {
        name: 'Envoyer un test au canal Équipe ops',
      }),
    )
    expect(
      await within(card).findByText('Message de test envoyé.'),
    ).toBeVisible()

    const toggle = within(card).getByLabelText('Activer le canal Équipe ops')

    fireEvent.click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())

    fireEvent.click(
      within(card).getByRole('button', {
        name: 'Supprimer le canal Équipe ops',
      }),
    )
    expect(
      await within(card).findByText('Aucun canal configuré.'),
    ).toBeVisible()
  })

  it('explains invalid destinations, duplicate names and failed tests', async () => {
    const card = await openSettings()

    await addChannel(card, 'Ops', 'http://insecure.example.com')
    expect(await within(card).findByRole('alert')).toHaveTextContent(
      'pas valide',
    )

    await addChannel(card, 'Cassé', 'https://hooks.slack.com/services/T/B/x')
    await within(card).findByText('Cassé')
    await addChannel(card, 'Cassé', 'https://hooks.slack.com/services/T/B/y')
    await waitFor(() =>
      expect(within(card).getByRole('alert')).toHaveTextContent('déjà utilisé'),
    )

    fireEvent.click(
      within(card).getByRole('button', {
        name: 'Envoyer un test au canal Cassé',
      }),
    )
    expect(await within(card).findByText(/n’a pas accepté/)).toBeVisible()
  })

  it('never displays the secret destination of a channel', async () => {
    const card = await openSettings()

    await addChannel(
      card,
      'Ops',
      'https://hooks.slack.com/services/T/B/SECRETVALUE',
    )
    await within(card).findByText('Ops')

    expect(card.textContent).not.toContain('SECRETVALUE')
  })
})

describe('weekly report', () => {
  it('lets the owner turn the Monday report off', async () => {
    const { fetchMock } = await renderAppWithMock()

    const toggle = await screen.findByLabelText(
      /Rapport hebdomadaire.*Un résumé/,
    )

    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer les préférences' }),
    )
    expect(await screen.findByText('Préférences enregistrées.')).toBeVisible()

    const patch = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith('/api/preferences') && init?.method === 'PATCH',
    )

    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({
      weeklyReportEnabled: false,
    })
  })
})

describe('incident reminders', () => {
  it('saves the reminder interval', async () => {
    const { fetchMock } = await renderAppWithMock()

    fireEvent.change(
      await screen.findByLabelText('Rappel tant qu’un incident reste ouvert'),
      { target: { value: '360' } },
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer les préférences' }),
    )
    expect(await screen.findByText('Préférences enregistrées.')).toBeVisible()

    const patch = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith('/api/preferences') && init?.method === 'PATCH',
    )

    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({
      reminderIntervalMinutes: 360,
    })
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

    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({
      displayName: 'Ada',
      notifyOnOpen: true,
      notifyOnResolve: false,
      timezone: 'Asia/Tokyo',
    })
  })
})

describe('display preferences and new-monitor defaults', () => {
  it('saves display options, defaults and the default folder', async () => {
    const { fetchMock } = await renderAppWithMock()

    fireEvent.change(await screen.findByLabelText('Format de l’heure'), {
      target: { value: '12h' },
    })
    fireEvent.change(screen.getByLabelText('Densité de l’interface'), {
      target: { value: 'comfortable' },
    })
    fireEvent.change(screen.getByLabelText('Vue par défaut du dashboard'), {
      target: { value: 'grid' },
    })
    fireEvent.change(screen.getByLabelText('Tri par défaut'), {
      target: { value: 'name' },
    })
    fireEvent.change(screen.getByLabelText('Dossier par défaut'), {
      target: { value: TEST_FOLDER_ID },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer les préférences' }),
    )

    expect(await screen.findByText('Préférences enregistrées.')).toBeVisible()

    const patch = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'PATCH',
    )

    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({
      dashboardSort: 'name',
      dashboardView: 'grid',
      defaultFolderId: TEST_FOLDER_ID,
      density: 'comfortable',
      timeFormat: '12h',
    })
    expect(document.documentElement.dataset['density']).toBe('comfortable')
  })

  it('pre-fills the new monitor form from a clone link', async () => {
    await renderApp('/monitors/new?interval=30&grace=3&name=Sync%20(copie)')

    expect(await screen.findByLabelText('Libellé local')).toHaveValue(
      'Sync (copie)',
    )
  })
})

describe('monitor details', () => {
  it('saves the description and notes and mutes alerts for one monitor', async () => {
    await renderApp(`/monitors/${MONITOR_ID}`, {
      monitors: monitorsWithFolder(),
    })
    const fetchMock = globalThis.fetch as unknown as import('vitest').Mock<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >
    const card = await screen.findByRole('region', {
      name: 'Description et notes',
    })

    fireEvent.change(within(card).getByLabelText('Description'), {
      target: { value: 'Sauvegarde nocturne' },
    })
    fireEvent.change(within(card).getByLabelText(/Notes/), {
      target: { value: 'Voir le runbook' },
    })
    fireEvent.click(within(card).getByRole('button', { name: 'Enregistrer' }))
    expect(await within(card).findByText('Enregistré.')).toBeVisible()

    fireEvent.click(
      within(card).getByLabelText(/Alertes e-mail de ce moniteur/),
    )

    await waitFor(() => {
      const bodies = fetchMock.mock.calls
        .filter(([input, init]) => {
          return (
            String(input).endsWith(`/${MONITOR_ID}/details`) &&
            init?.method === 'PATCH'
          )
        })
        .map(([, init]) => JSON.parse(String(init?.body)))

      expect(bodies).toContainEqual({
        description: 'Sauvegarde nocturne',
        notes: 'Voir le runbook',
      })
      expect(bodies).toContainEqual({ alertsEnabled: false })
    })
  })

  it('offers to clone a monitor with its schedule', async () => {
    await renderApp(`/monitors/${MONITOR_ID}`, {
      monitors: monitorsWithFolder(),
    })

    const clone = await screen.findByRole('link', { name: /Cloner/ })

    expect(clone.getAttribute('href')).toMatch(/grace=30/u)
    expect(clone.getAttribute('href')).toMatch(/interval=1440/u)
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
