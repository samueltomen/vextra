import type {
  NotificationKind,
  NotificationSender,
} from '../../application/deliver-notifications.ts'
import { renderNotificationEmail } from './render-notification-email.ts'

const RESEND_EMAILS_URL = 'https://api.resend.com/emails'

export class ResendNotificationSender implements NotificationSender {
  constructor(
    private readonly dependencies: Readonly<{
      apiKey: string
      appOrigin: string
      from: string
    }>,
  ) {}

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
    const response = await fetch(RESEND_EMAILS_URL, {
      body: JSON.stringify({
        from: this.dependencies.from,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to: input.to,
      }),
      headers: {
        Authorization: `Bearer ${this.dependencies.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null)
      const name =
        typeof body === 'object' &&
        body !== null &&
        'name' in body &&
        typeof body.name === 'string'
          ? body.name
          : null

      console.warn(
        JSON.stringify({
          event: 'notification.provider_rejected',
          name,
          status: response.status,
        }),
      )
      throw new Error('email delivery failed')
    }
  }
}
