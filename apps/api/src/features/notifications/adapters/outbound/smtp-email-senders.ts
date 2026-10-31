import type {
  NotificationKind,
  NotificationSender,
} from '../../application/deliver-notifications.ts'
import type {
  WeeklyReport,
  WeeklyReportSender,
} from '../../application/send-weekly-reports.ts'
import {
  renderNotificationEmail,
  renderWeeklyReportEmail,
} from './render-notification-email.ts'

export type MailMessage = Readonly<{
  from: string
  html: string
  subject: string
  text: string
  to: string
}>

/** Minimal shape of a nodemailer transport, so it can be faked in tests. */
export interface MailTransport {
  sendMail(message: MailMessage): Promise<unknown>
}

type SmtpDependencies = Readonly<{
  appOrigin: string
  from: string
  transport: MailTransport
}>

function errorCode(error: unknown): string | null {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : null
}

async function deliver(
  transport: MailTransport,
  message: MailMessage,
  event: string,
): Promise<void> {
  try {
    await transport.sendMail(message)
  } catch (error) {
    // Only the error code is logged: never the recipient or the SMTP message.
    console.warn(JSON.stringify({ code: errorCode(error), event }))
    throw new Error('email delivery failed', { cause: error })
  }
}

export class SmtpNotificationSender implements NotificationSender {
  constructor(private readonly dependencies: SmtpDependencies) {}

  async send(input: {
    kind: NotificationKind
    monitorId: string
    monitorName: string | null
    to: string
  }): Promise<void> {
    const message = renderNotificationEmail({
      appOrigin: this.dependencies.appOrigin,
      kind: input.kind,
      monitorId: input.monitorId,
      monitorName: input.monitorName,
    })

    await deliver(
      this.dependencies.transport,
      {
        from: this.dependencies.from,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: input.to,
      },
      'notification.smtp_failed',
    )
  }
}

export class SmtpWeeklyReportSender implements WeeklyReportSender {
  constructor(private readonly dependencies: SmtpDependencies) {}

  async send(report: WeeklyReport): Promise<void> {
    const message = renderWeeklyReportEmail({
      appOrigin: this.dependencies.appOrigin,
      report,
    })

    await deliver(
      this.dependencies.transport,
      {
        from: this.dependencies.from,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: report.email,
      },
      'weekly_report.smtp_failed',
    )
  }
}
