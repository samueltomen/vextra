import type {
  NotificationKind,
  NotificationSender,
} from '../../application/deliver-notifications.ts'

const RESEND_EMAILS_URL = 'https://api.resend.com/emails'

function messageFor(
  kind: NotificationKind,
  monitorId: string,
): { subject: string; text: string } {
  if (kind === 'incident_opened') {
    return {
      subject: 'CronPing · heartbeat manquant',
      text: `Le moniteur ${monitorId} n’a pas reçu de heartbeat dans la fenêtre attendue. Ouvrez CronPing pour consulter son état.`,
    }
  }

  return {
    subject: 'CronPing · heartbeat reçu',
    text: `Le moniteur ${monitorId} a reçu un nouveau heartbeat. L’incident en cours est résolu.`,
  }
}

export class ResendNotificationSender implements NotificationSender {
  constructor(
    private readonly dependencies: Readonly<{
      apiKey: string
      from: string
    }>,
  ) {}

  async send(input: {
    kind: NotificationKind
    monitorId: string
    to: string
  }): Promise<void> {
    const message = messageFor(input.kind, input.monitorId)
    const response = await fetch(RESEND_EMAILS_URL, {
      body: JSON.stringify({
        from: this.dependencies.from,
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
      throw new Error('email delivery failed')
    }
  }
}
