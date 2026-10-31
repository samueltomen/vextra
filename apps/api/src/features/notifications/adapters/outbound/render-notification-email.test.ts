import { describe, expect, it } from 'vitest'

import type { WeeklyReport } from '../../application/send-weekly-reports.ts'
import {
  renderNotificationEmail,
  renderWeeklyReportEmail,
} from './render-notification-email.ts'

const MONITOR_ID = '20000000-0000-4000-8000-000000000001'
const APP_ORIGIN = 'https://cronping.example.test'

describe('renderNotificationEmail', () => {
  it('renders an incident alert with the app palette and a monitor link', () => {
    const email = renderNotificationEmail({
      appOrigin: APP_ORIGIN,
      kind: 'incident_opened',
      monitorId: MONITOR_ID,
    })

    expect(email.subject).toBe('CronPing · heartbeat manquant')
    expect(email.html).toContain('<!doctype html>')
    expect(email.html).toContain('#0f766e')
    expect(email.html).toContain('#d6403a')
    expect(email.html).toContain('Heartbeat manquant')
    expect(email.html).toContain(`href="${APP_ORIGIN}/monitors/${MONITOR_ID}"`)
    expect(email.html).toContain('prefers-color-scheme: dark')
    expect(email.text).toContain(`${APP_ORIGIN}/monitors/${MONITOR_ID}`)
  })

  it('renders a recovery alert with the healthy color', () => {
    const email = renderNotificationEmail({
      appOrigin: APP_ORIGIN,
      kind: 'incident_resolved',
      monitorId: MONITOR_ID,
    })

    expect(email.subject).toBe('CronPing · heartbeat reçu')
    expect(email.html).toContain('#16a36a')
    expect(email.html).toContain('Incident résolu')
    expect(email.html).not.toContain('#d6403a')
  })

  it('never embeds unescaped input in the HTML', () => {
    const email = renderNotificationEmail({
      appOrigin: APP_ORIGIN,
      kind: 'incident_opened',
      monitorId: '"><script>alert(1)</script>',
    })

    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;')
  })

  it('normalizes a trailing slash on the application origin', () => {
    const email = renderNotificationEmail({
      appOrigin: `${APP_ORIGIN}/`,
      kind: 'incident_opened',
      monitorId: MONITOR_ID,
    })

    expect(email.text).toContain(`${APP_ORIGIN}/monitors/${MONITOR_ID}`)
    expect(email.text).not.toContain('.test//monitors')
  })

  it('shows the monitor name, escaped, when it is known', () => {
    const email = renderNotificationEmail({
      appOrigin: APP_ORIGIN,
      kind: 'incident_opened',
      monitorId: MONITOR_ID,
      monitorName: 'Sync <b>Stripe</b>',
    })

    expect(email.html).toContain('Sync &lt;b&gt;Stripe&lt;/b&gt;')
    expect(email.html).not.toContain('<b>Stripe</b>')
    expect(email.text).toContain('Nom : Sync <b>Stripe</b>')
  })

  it('omits the name block when the monitor has no name', () => {
    const email = renderNotificationEmail({
      appOrigin: APP_ORIGIN,
      kind: 'incident_opened',
      monitorId: MONITOR_ID,
      monitorName: null,
    })

    expect(email.text).not.toContain('Nom :')
  })

  it('renders a failed run with the failure color and subject', () => {
    const email = renderNotificationEmail({
      appOrigin: APP_ORIGIN,
      kind: 'run_failed',
      monitorId: MONITOR_ID,
    })

    expect(email.subject).toBe('CronPing · exécution en échec')
    expect(email.html).toContain('Exécution en échec')
    expect(email.html).toContain('#d6403a')
    expect(email.text).toContain('échec')
  })
})

describe('renderWeeklyReportEmail', () => {
  const REPORT: WeeklyReport = {
    displayName: 'Ada <b>',
    email: 'owner@example.test',
    fails7d: 2,
    incidentsOpenNow: 0,
    incidentsOpened: 1,
    monitorsTotal: 3,
    pings7d: 12_500,
    problemMonitors: [
      {
        id: '20000000-0000-4000-8000-000000000001',
        incidents: 2,
        name: 'Sync <i>Stripe</i>',
      },
      { id: '20000000-0000-4000-8000-000000000002', incidents: 1, name: null },
    ],
    tenantId: 't1',
    weekStart: '2026-11-02',
  }

  it('summarizes the week with links, totals and escaped names', () => {
    const email = renderWeeklyReportEmail({
      appOrigin: 'https://app.test/',
      report: REPORT,
    })

    expect(email.subject).toBe('CronPing · votre rapport de la semaine')
    expect(email.html).toContain('Bonjour Ada &lt;b&gt;,')
    expect(email.html).toContain('Sync &lt;i&gt;Stripe&lt;/i&gt;')
    expect(email.html).not.toContain('<i>Stripe</i>')
    expect(email.html).toContain(
      'href="https://app.test/monitors/20000000-0000-4000-8000-000000000001"',
    )
    expect(email.html).toContain('#16a36a')
    expect(email.html).toContain('prefers-color-scheme: dark')
    expect(email.text).toContain(
      'Moniteur 20000000-0000-4000-8000-000000000002'.slice(0, 17),
    )
    expect(email.text).toContain(
      'Désactiver ce rapport : https://app.test/settings',
    )
  })

  it('warns when incidents are still open and hides empty sections', () => {
    const email = renderWeeklyReportEmail({
      appOrigin: 'https://app.test',
      report: {
        ...REPORT,
        displayName: null,
        incidentsOpenNow: 2,
        problemMonitors: [],
      },
    })

    expect(email.html).toContain('#d6403a')
    expect(email.html).toContain('Bonjour,')
    expect(email.html).not.toContain('Moniteurs à surveiller')
    expect(email.text).not.toContain('Moniteurs à surveiller')
  })
})
