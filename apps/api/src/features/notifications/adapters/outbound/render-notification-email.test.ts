import { describe, expect, it } from 'vitest'

import { renderNotificationEmail } from './render-notification-email.ts'

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
})
