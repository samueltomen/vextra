import { describe, expect, it, vi } from 'vitest'

import type { WeeklyReport } from '../../application/send-weekly-reports.ts'
import {
  SmtpNotificationSender,
  SmtpWeeklyReportSender,
  type MailMessage,
} from './smtp-email-senders.ts'

const DEPENDENCIES = {
  appOrigin: 'https://app.test',
  from: 'Vextra <alerts@example.test>',
}

const REPORT: WeeklyReport = {
  displayName: null,
  email: 'owner@example.test',
  fails7d: 0,
  incidentsOpenNow: 0,
  incidentsOpened: 0,
  monitorsTotal: 1,
  pings7d: 10,
  problemMonitors: [],
  tenantId: 't1',
  weekStart: '2026-11-02',
}

describe('SmtpNotificationSender', () => {
  it('sends the HTML alert with a text alternative through the transport', async () => {
    const sendMail = vi.fn<(message: MailMessage) => Promise<undefined>>(
      async () => undefined,
    )

    await new SmtpNotificationSender({
      ...DEPENDENCIES,
      transport: { sendMail },
    }).send({
      kind: 'incident_opened',
      monitorId: '20000000-0000-4000-8000-000000000001',
      monitorName: 'Sync Stripe',
      to: 'owner@example.test',
    })

    const message = sendMail.mock.calls[0]?.[0]

    expect(message).toMatchObject({
      from: DEPENDENCIES.from,
      subject: 'Vextra · heartbeat manquant',
      to: 'owner@example.test',
    })
    expect(message?.html).toContain('Sync Stripe')
    expect(message?.text).toContain('Sync Stripe')
  })

  it('logs only the error code and hides the SMTP message and the recipient', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const failure = Object.assign(new Error('550 owner@example.test refused'), {
      code: 'EENVELOPE',
    })

    await expect(
      new SmtpNotificationSender({
        ...DEPENDENCIES,
        transport: {
          sendMail: async () => {
            throw failure
          },
        },
      }).send({
        kind: 'run_failed',
        monitorId: 'm1',
        monitorName: null,
        to: 'owner@example.test',
      }),
    ).rejects.toThrow('email delivery failed')
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({ code: 'EENVELOPE', event: 'notification.smtp_failed' }),
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain('owner@example.test')
    warn.mockRestore()
  })
})

describe('SmtpWeeklyReportSender', () => {
  it('sends the weekly report to the owner', async () => {
    const sendMail = vi.fn<(message: MailMessage) => Promise<undefined>>(
      async () => undefined,
    )

    await new SmtpWeeklyReportSender({
      ...DEPENDENCIES,
      transport: { sendMail },
    }).send(REPORT)

    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({
      subject: 'Vextra · votre rapport de la semaine',
      to: 'owner@example.test',
    })
  })

  it('rejects when the transport fails, without a code if none is provided', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(
      new SmtpWeeklyReportSender({
        ...DEPENDENCIES,
        transport: {
          sendMail: async () => {
            throw new Error('down')
          },
        },
      }).send(REPORT),
    ).rejects.toThrow('email delivery failed')
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({ code: null, event: 'weekly_report.smtp_failed' }),
    )
    warn.mockRestore()
  })
})
