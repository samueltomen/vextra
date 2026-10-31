import { describe, expect, it, vi } from 'vitest'

import { ResendNotificationSender } from './resend-notification-sender.ts'

const INPUT = {
  kind: 'incident_opened' as const,
  monitorId: '20000000-0000-4000-8000-000000000001',
  monitorName: 'Sauvegarde nocturne',
  to: 'owner@example.test',
}

describe('ResendNotificationSender', () => {
  it('sends a content-minimal alert through Resend', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input
        void init

        return Response.json({ id: 'email-1' })
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    const sender = new ResendNotificationSender({
      apiKey: 're_test',
      appOrigin: 'https://cronping.example.test',
      from: 'CronPing <alerts@example.test>',
    })

    await expect(sender.send(INPUT)).resolves.toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0]!
    const body = JSON.parse(String(init?.body))

    expect(url).toBe('https://api.resend.com/emails')
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer re_test',
    })
    expect(body).toMatchObject({
      from: 'CronPing <alerts@example.test>',
      to: INPUT.to,
    })
    expect(body.subject).toContain('heartbeat')
    expect(body.text).toContain(INPUT.monitorId)
    expect(body.text).not.toContain('owner@example.test')
    expect(body.html).toContain('<!doctype html>')
    expect(body.html).not.toContain('owner@example.test')
  })

  it('rejects provider failures without exposing the recipient', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { message: 'provider failure for owner@example.test' },
          { status: 502 },
        ),
      ),
    )
    const sender = new ResendNotificationSender({
      apiKey: 're_test',
      appOrigin: 'https://cronping.example.test',
      from: 'CronPing <alerts@example.test>',
    })

    await expect(sender.send(INPUT)).rejects.toThrow('email delivery failed')
  })

  it('logs the Resend status and error name without the message or recipient', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            message: 'domain not verified for owner@example.test',
            name: 'validation_error',
            statusCode: 403,
          },
          { status: 403 },
        ),
      ),
    )
    const sender = new ResendNotificationSender({
      apiKey: 're_test',
      appOrigin: 'https://cronping.example.test',
      from: 'CronPing <alerts@example.test>',
    })

    await expect(sender.send(INPUT)).rejects.toThrow('email delivery failed')

    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'notification.provider_rejected',
        name: 'validation_error',
        status: 403,
      }),
    )
    warn.mockRestore()
  })
})
