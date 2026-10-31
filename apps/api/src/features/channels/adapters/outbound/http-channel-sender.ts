import {
  ChannelDeliveryError,
  type AlertEvent,
  type ChannelAlert,
  type ChannelKind,
  type ChannelSender,
} from '../../application/channels.ts'

const TITLES: Readonly<Record<AlertEvent, string>> = {
  incident_opened: 'Heartbeat manquant',
  incident_resolved: 'Incident résolu',
  reminder: 'Rappel : incident toujours ouvert',
  run_failed: 'Exécution en échec',
  test: 'Test d’alerte Vextra',
}

const REQUEST_TIMEOUT_MS = 8_000

function monitorLabel(alert: ChannelAlert): string {
  return alert.monitorName?.trim() || `Moniteur ${alert.monitorId.slice(0, 8)}`
}

function monitorUrl(alert: ChannelAlert): string {
  const origin = alert.appOrigin.replace(/\/+$/u, '')

  return alert.event === 'test'
    ? origin
    : `${origin}/monitors/${alert.monitorId}`
}

export type ChannelRequest = Readonly<{ body: unknown; url: string }>

/** Builds the provider specific request. Pure: easy to test, no network. */
export function buildChannelRequest(
  kind: ChannelKind,
  target: string,
  alert: ChannelAlert,
): ChannelRequest {
  const title = TITLES[alert.event]
  const label = monitorLabel(alert)
  const url = monitorUrl(alert)
  const text = `${title} — ${label}`

  switch (kind) {
    case 'slack':
      return {
        body: { text: `*${title}* — ${label}\n<${url}|Ouvrir>` },
        url: target,
      }
    case 'discord':
      return {
        body: { content: `**${title}** — ${label}\n${url}` },
        url: target,
      }
    case 'telegram': {
      const [token, chatId] = target.split('|')

      return {
        body: {
          chat_id: chatId,
          disable_web_page_preview: true,
          text: `${text}\n${url}`,
        },
        url: `https://api.telegram.org/bot${token}/sendMessage`,
      }
    }
    case 'pagerduty':
      return {
        body: {
          dedup_key: alert.event === 'test' ? 'vextra-test' : alert.monitorId,
          event_action:
            alert.event === 'incident_resolved' ? 'resolve' : 'trigger',
          payload: {
            custom_details: { url },
            severity: alert.event === 'test' ? 'info' : 'error',
            source: 'vextra',
            summary: text,
          },
          routing_key: target,
        },
        url: 'https://events.pagerduty.com/v2/enqueue',
      }
    default:
      // Generic webhook and Microsoft Teams (Workflows webhook): JSON with a
      // ready-to-display `text` plus structured fields.
      return {
        body: {
          event: alert.event,
          monitor: {
            id: alert.event === 'test' ? null : alert.monitorId,
            name: alert.monitorName,
            url,
          },
          openedAt:
            alert.openedAtMs === null
              ? null
              : new Date(alert.openedAtMs).toISOString(),
          source: 'vextra',
          text,
          title,
        },
        url: target,
      }
  }
}

export class HttpChannelSender implements ChannelSender {
  async send(
    input: Readonly<{ alert: ChannelAlert; kind: ChannelKind; target: string }>,
  ): Promise<void> {
    const request = buildChannelRequest(input.kind, input.target, input.alert)
    let response: Response

    try {
      response = await fetch(request.url, {
        body: JSON.stringify(request.body),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        // Never follow redirects: a hostile endpoint must not bounce us to an
        // internal address.
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      console.warn(
        JSON.stringify({ event: 'channel.delivery_failed', kind: input.kind }),
      )
      throw new ChannelDeliveryError()
    }

    if (!response.ok) {
      console.warn(
        JSON.stringify({
          event: 'channel.delivery_rejected',
          kind: input.kind,
          status: response.status,
        }),
      )
      throw new ChannelDeliveryError()
    }
  }
}
