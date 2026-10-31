import { describe, expect, it, vi } from 'vitest'

import {
  DeliverChannelAlerts,
  EnqueueIncidentReminders,
  InvalidChannelTargetError,
  ManageChannels,
  normalizeChannelTarget,
  type ChannelDeliveryQueue,
  type ChannelPort,
  type ChannelSender,
  type ClaimedChannelDelivery,
} from './channels.ts'

const PD_KEY = 'a1B2c3D4e5F6a1B2c3D4e5F6a1B2c3D4'
const TELEGRAM = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw|-1001234567'

describe('normalizeChannelTarget', () => {
  it('accepts valid destinations and returns a masked hint', () => {
    expect(
      normalizeChannelTarget(
        'slack',
        ' https://hooks.slack.com/services/T000/B000/abcd1234 ',
      ),
    ).toEqual({
      hint: 'hooks.slack.com/…1234',
      target: 'https://hooks.slack.com/services/T000/B000/abcd1234',
    })
    expect(
      normalizeChannelTarget(
        'discord',
        'https://discord.com/api/webhooks/1234/tokenZZ',
      ).hint,
    ).toBe('discord.com/…enZZ')
    expect(
      normalizeChannelTarget('webhook', 'https://example.com/hook').hint,
    ).toBe('example.com/…hook')
    expect(
      normalizeChannelTarget(
        'teams',
        'https://prod-1.westeurope.logic.azure.com/x/y',
      ).target,
    ).toContain('logic.azure.com')
    expect(normalizeChannelTarget('telegram', TELEGRAM).hint).toBe(
      'chat -1001234567',
    )
    expect(normalizeChannelTarget('pagerduty', PD_KEY).hint).toBe('clé …c3D4')
  })

  it.each([
    ['webhook', 'http://example.com/hook'],
    ['webhook', 'https://localhost/hook'],
    ['webhook', 'https://127.0.0.1/hook'],
    ['webhook', 'https://[::1]/hook'],
    ['webhook', 'https://intranet/hook'],
    ['webhook', 'https://db.internal/hook'],
    ['webhook', 'https://user:pass@example.com/hook'],
    ['webhook', 'https://example.com:8443/hook'],
    ['webhook', 'not a url'],
    ['slack', 'https://example.com/services/T/B/x'],
    ['slack', 'https://hooks.slack.com/other/path'],
    ['discord', 'https://evil.test/api/webhooks/1/x'],
    ['discord', 'https://discord.com/other'],
    ['telegram', 'no-pipe'],
    ['telegram', '123:short|1'],
    ['pagerduty', 'too-short'],
  ] as const)('rejects %s target %s', (kind, target) => {
    expect(() => normalizeChannelTarget(kind, target)).toThrow(
      InvalidChannelTargetError,
    )
  })
})

describe('ManageChannels', () => {
  function create(
    findTarget: () => Promise<{ kind: 'slack'; target: string } | null>,
  ) {
    const channels = {
      create: vi.fn(async (_tenantId: string, input: { name: string }) => ({
        createdAtMs: 0,
        enabled: true,
        id: 'c1',
        kind: 'slack' as const,
        name: input.name,
        targetHint: 'hint',
      })),
      list: vi.fn(async () => []),
      remove: vi.fn(async () => true),
      setEnabled: vi.fn(async () => true),
    } satisfies ChannelPort
    const sender = {
      send: vi.fn(async () => undefined),
    } satisfies ChannelSender
    const service = new ManageChannels({
      appOrigin: 'https://app.test',
      channels,
      secrets: { findTarget },
      sender,
    })

    return { channels, sender, service }
  }

  it('validates the target before storing it', async () => {
    const { channels, service } = create(async () => null)

    await expect(
      service.create('t', {
        kind: 'slack',
        name: 'Ops',
        target: 'https://example.com/x',
      }),
    ).rejects.toBeInstanceOf(InvalidChannelTargetError)
    expect(channels.create).not.toHaveBeenCalled()

    await service.create('t', {
      kind: 'slack',
      name: 'Ops',
      target: 'https://hooks.slack.com/services/T/B/abcd',
    })
    expect(channels.create).toHaveBeenCalledWith('t', {
      kind: 'slack',
      name: 'Ops',
      target: 'https://hooks.slack.com/services/T/B/abcd',
      targetHint: 'hooks.slack.com/…abcd',
    })
  })

  it('delegates listing, enabling and removal within the tenant', async () => {
    const { channels, service } = create(async () => null)

    await service.list('t')
    await service.setEnabled('t', 'c1', false)
    await service.remove('t', 'c1')

    expect(channels.list).toHaveBeenCalledWith('t')
    expect(channels.setEnabled).toHaveBeenCalledWith('t', 'c1', false)
    expect(channels.remove).toHaveBeenCalledWith('t', 'c1')
  })

  it('sends a test message with the stored secret, or reports a missing channel', async () => {
    const found = create(async () => ({
      kind: 'slack',
      target: 'https://hooks.slack.com/services/T/B/abcd',
    }))

    await expect(found.service.test('t', 'c1')).resolves.toBe(true)
    expect(found.sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        alert: expect.objectContaining({ event: 'test' }),
        kind: 'slack',
      }),
    )

    const missing = create(async () => null)

    await expect(missing.service.test('t', 'c1')).resolves.toBe(false)
    expect(missing.sender.send).not.toHaveBeenCalled()
  })
})

describe('DeliverChannelAlerts', () => {
  const DELIVERY: ClaimedChannelDelivery = {
    attempts: 1,
    channelKind: 'slack',
    channelName: 'Ops',
    deliveryId: 'd1',
    event: 'incident_opened',
    monitorId: 'm1',
    monitorName: 'Sync',
    openedAtMs: 1,
    target: 'https://hooks.slack.com/services/T/B/x',
  }

  function queue(deliveries: readonly ClaimedChannelDelivery[]) {
    return {
      claim: vi.fn(async () => deliveries),
      complete: vi.fn(async () => undefined),
    } satisfies ChannelDeliveryQueue
  }

  it('sends each claimed delivery and records success', async () => {
    const jobs = queue([DELIVERY])
    const sender = { send: vi.fn(async () => undefined) }
    const result = await new DeliverChannelAlerts({
      appOrigin: 'https://app.test',
      queue: jobs,
      sender,
    }).execute()

    expect(result).toEqual({ failed: 0, sent: 1 })
    expect(jobs.complete).toHaveBeenCalledWith({
      deliveryId: 'd1',
      errorCode: null,
      success: true,
    })
  })

  it('records a failure without exposing the provider error', async () => {
    const jobs = queue([DELIVERY])
    const result = await new DeliverChannelAlerts({
      appOrigin: 'https://app.test',
      queue: jobs,
      sender: {
        send: async () => {
          throw new Error('secret leaked in message')
        },
      },
    }).execute()

    expect(result).toEqual({ failed: 1, sent: 0 })
    expect(jobs.complete).toHaveBeenCalledWith({
      deliveryId: 'd1',
      errorCode: 'channel_delivery_failed',
      success: false,
    })
  })
})

describe('EnqueueIncidentReminders', () => {
  it('returns the number of reminders enqueued', async () => {
    await expect(
      new EnqueueIncidentReminders({ enqueue: async () => 3 }).execute(),
    ).resolves.toBe(3)
  })
})
