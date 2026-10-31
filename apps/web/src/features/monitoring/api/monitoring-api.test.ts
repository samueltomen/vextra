import { describe, expect, it } from 'vitest'

import { installApiMock, TEST_MONITOR_LABELS } from '../../../test/api-mock.ts'
import { createMonitor, getMonitor, listMonitors } from './monitoring-api.ts'

describe('monitoring API adapter', () => {
  it('merges server state with local labels', async () => {
    installApiMock()
    window.localStorage.setItem(
      'vextra.monitor-labels.v1',
      JSON.stringify(TEST_MONITOR_LABELS),
    )

    const monitors = await listMonitors()

    expect(monitors[0]).toMatchObject({
      id: '20000000-0000-4000-8000-000000000001',
      localLabel: 'Sauvegarde PostgreSQL',
      status: 'healthy',
    })
  })

  it('uses an opaque fallback label when no local label exists', async () => {
    installApiMock()

    await expect(
      getMonitor('20000000-0000-4000-8000-000000000002'),
    ).resolves.toMatchObject({
      localLabel: 'Moniteur 20000000',
      status: 'late',
    })
  })

  it('maps missing monitors to null without hiding other API errors', async () => {
    installApiMock()

    await expect(
      getMonitor('20000000-0000-4000-8000-000000000099'),
    ).resolves.toBeNull()
  })

  it('sends only technical monitor fields and stores the label locally', async () => {
    const { fetchMock } = installApiMock()

    await createMonitor({
      graceMinutes: 2,
      intervalMinutes: 5,
      localLabel: 'Backup DB',
    })

    const request = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input) === '/api/monitors' && init?.method === 'POST',
    )

    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      graceSeconds: 120,
      intervalSeconds: 300,
    })
    expect(window.localStorage.getItem('vextra.monitor-labels.v1')).toContain(
      'Backup DB',
    )
  })
})
