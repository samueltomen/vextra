import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ChannelDeliveryError,
  type ChannelAlert,
} from '../../application/channels.ts'
import {
  buildChannelRequest,
  HttpChannelSender,
} from './http-channel-sender.ts'

const ALERT: ChannelAlert = {
  appOrigin: 'https://app.test/',
  event: 'incident_opened',
  monitorId: '20000000-0000-4000-8000-000000000001',
  monitorName: 'Sync Stripe',
  openedAtMs: Date.parse('2026-10-31T12:00:00.000Z'),
}

describe('buildChannelRequest', () => {
  it('formats Slack and Discord messages with a link to the monitor', () => {
    const slack = buildChannelRequest(
      'slack',
      'https://hooks.slack.com/x',
      ALERT,
    )

    expect(slack.url).toBe('https://hooks.slack.com/x')
    expect(slack.body).toEqual({
      text: '*Heartbeat manquant* — Sync Stripe\n<https://app.test/monitors/20000000-0000-4000-8000-000000000001|Ouvrir>',
    })
    expect(
      buildChannelRequest(
        'discord',
        'https://discord.com/api/webhooks/1/x',
        ALERT,
      ).body,
    ).toEqual({
      content:
        '**Heartbeat manquant** — Sync Stripe\nhttps://app.test/monitors/20000000-0000-4000-8000-000000000001',
    })
  })

  it('splits the Telegram secret into a bot URL and a chat id', () => {
    const telegram = buildChannelRequest(
      'telegram',
      '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5P|-100',
      ALERT,
    )

    expect(telegram.url).toBe(
      'https://api.telegram.org/bot123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5P/sendMessage',
    )
    expect(telegram.body).toMatchObject({ chat_id: '-100' })
  })

  it('triggers and resolves PagerDuty incidents with a stable dedup key', () => {
    const trigger = buildChannelRequest('pagerduty', 'KEY', ALERT)
    const resolve = buildChannelRequest('pagerduty', 'KEY', {
      ...ALERT,
      event: 'incident_resolved',
    })

    expect(trigger.url).toBe('https://events.pagerduty.com/v2/enqueue')
    expect(trigger.body).toMatchObject({
      dedup_key: ALERT.monitorId,
      event_action: 'trigger',
      routing_key: 'KEY',
    })
    expect(resolve.body).toMatchObject({ event_action: 'resolve' })
  })

  it('sends structured JSON to a generic webhook and falls back on a short id', () => {
    const webhook = buildChannelRequest('webhook', 'https://example.com/h', {
      ...ALERT,
      monitorName: null,
    })

    expect(webhook.body).toMatchObject({
      event: 'incident_opened',
      monitor: { id: ALERT.monitorId, name: null },
      openedAt: '2026-10-31T12:00:00.000Z',
      source: 'cronping',
      text: 'Heartbeat manquant — Moniteur 20000000',
    })
  })

  it('never pages for a test message', () => {
    const test = buildChannelRequest('pagerduty', 'KEY', {
      ...ALERT,
      event: 'test',
      openedAtMs: null,
    })

    expect(test.body).toMatchObject({
      dedup_key: 'cronping-test',
      payload: { severity: 'info' },
    })
    expect(
      buildChannelRequest('webhook', 'https://example.com/h', {
        ...ALERT,
        event: 'test',
        openedAtMs: null,
      }).body,
    ).toMatchObject({ monitor: { id: null, url: 'https://app.test' } })
  })
})

describe('HttpChannelSender', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts JSON without following redirects', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

    vi.stubGlobal('fetch', fetchMock)
    await new HttpChannelSender().send({
      alert: ALERT,
      kind: 'webhook',
      target: 'https://example.com/hook',
    })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]

    expect(url).toBe('https://example.com/hook')
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('manual')
  })

  it('fails with a generic error and logs only the status', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('secret body', { status: 403 })),
    )

    await expect(
      new HttpChannelSender().send({
        alert: ALERT,
        kind: 'slack',
        target: 'https://hooks.slack.com/services/SECRET',
      }),
    ).rejects.toBeInstanceOf(ChannelDeliveryError)
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'channel.delivery_rejected',
        kind: 'slack',
        status: 403,
      }),
    )

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    await expect(
      new HttpChannelSender().send({
        alert: ALERT,
        kind: 'slack',
        target: 'https://hooks.slack.com/services/SECRET',
      }),
    ).rejects.toBeInstanceOf(ChannelDeliveryError)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('SECRET')
    warn.mockRestore()
  })

  it('treats a redirect as a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 302 })),
    )
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(
      new HttpChannelSender().send({
        alert: ALERT,
        kind: 'webhook',
        target: 'https://example.com/hook',
      }),
    ).rejects.toBeInstanceOf(ChannelDeliveryError)
  })
})
