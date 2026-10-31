import { describe, expect, it, vi } from 'vitest'

import {
  ChannelDeliveryError,
  ChannelLimitError,
  ChannelNameTakenError,
  InvalidChannelTargetError,
} from '../../../application/channels.ts'
import { createChannelRoutes, type ChannelScope } from './channel-routes.ts'

const CHANNEL_ID = '30000000-0000-4000-8000-000000000001'
const CHANNEL = {
  createdAtMs: Date.parse('2026-10-31T10:00:00.000Z'),
  enabled: true,
  id: CHANNEL_ID,
  kind: 'slack' as const,
  name: 'Ops',
  targetHint: 'hooks.slack.com/…abcd',
}

function scope(overrides: Partial<ChannelScope['channels']> = {}) {
  return {
    channels: {
      create: vi.fn(async () => CHANNEL),
      list: vi.fn(async () => [CHANNEL]),
      remove: vi.fn(async () => true),
      setEnabled: vi.fn(async () => true),
      test: vi.fn(async () => true),
      ...overrides,
    },
    tenantId: 'tenant-a',
  } satisfies ChannelScope
}

function app(current: ChannelScope | null = scope()) {
  return createChannelRoutes({ authenticate: async () => current })
}

function json(method: string, body: unknown) {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method,
  }
}

describe('channel routes', () => {
  it.each([
    ['GET', '/api/channels'],
    ['POST', '/api/channels'],
    ['PATCH', `/api/channels/${CHANNEL_ID}`],
    ['DELETE', `/api/channels/${CHANNEL_ID}`],
    ['POST', `/api/channels/${CHANNEL_ID}/test`],
  ])('requires a session for %s %s', async (method, path) => {
    expect((await app(null).request(path, { method })).status).toBe(401)
  })

  it('lists channels without any secret', async () => {
    const response = await app().request('/api/channels')

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: { channels: Record<string, unknown>[] }
    }

    expect(body.data.channels[0]).toEqual({
      createdAt: '2026-10-31T10:00:00.000Z',
      enabled: true,
      id: CHANNEL_ID,
      kind: 'slack',
      name: 'Ops',
      targetHint: 'hooks.slack.com/…abcd',
    })
    expect(JSON.stringify(body)).not.toContain('target"')
  })

  it('creates a channel for the session tenant and rejects client tenants', async () => {
    const current = scope()
    const created = await app(current).request(
      '/api/channels',
      json('POST', {
        kind: 'slack',
        name: 'Ops',
        target: 'https://hooks.slack.com/services/T/B/abcd',
      }),
    )

    expect(created.status).toBe(201)
    expect(current.channels.create).toHaveBeenCalledWith('tenant-a', {
      kind: 'slack',
      name: 'Ops',
      target: 'https://hooks.slack.com/services/T/B/abcd',
    })
    expect(
      (
        await app().request(
          '/api/channels',
          json('POST', {
            kind: 'slack',
            name: 'x',
            target: 'y',
            tenantId: 'tenant-b',
          }),
        )
      ).status,
    ).toBe(422)
    expect(
      (await app().request('/api/channels', { body: '{', method: 'POST' }))
        .status,
    ).toBe(400)
  })

  it('maps domain errors to stable HTTP errors', async () => {
    const cases: Array<[Error, number, string]> = [
      [new ChannelNameTakenError(), 409, 'channel_name_taken'],
      [new ChannelLimitError(), 409, 'channel_limit_reached'],
      [new InvalidChannelTargetError(), 422, 'invalid_channel_target'],
      [new ChannelDeliveryError(), 502, 'channel_test_failed'],
      [new Error('boom'), 500, 'internal_error'],
    ]

    for (const [error, status, code] of cases) {
      const response = await app(
        scope({
          create: vi.fn(async () => {
            throw error
          }),
        }),
      ).request(
        '/api/channels',
        json('POST', { kind: 'webhook', name: 'x', target: 'y' }),
      )

      expect(response.status).toBe(status)
      await expect(response.json()).resolves.toMatchObject({ error: { code } })
    }
  })

  it('enables, removes and tests a channel, answering 404 for unknown ones', async () => {
    expect(
      (
        await app().request(
          `/api/channels/${CHANNEL_ID}`,
          json('PATCH', { enabled: false }),
        )
      ).status,
    ).toBe(204)
    expect(
      (
        await app(scope({ setEnabled: vi.fn(async () => false) })).request(
          `/api/channels/${CHANNEL_ID}`,
          json('PATCH', { enabled: false }),
        )
      ).status,
    ).toBe(404)
    expect(
      (
        await app().request(
          `/api/channels/${CHANNEL_ID}`,
          json('PATCH', { name: 'x' }),
        )
      ).status,
    ).toBe(422)
    expect(
      (
        await app().request(
          '/api/channels/nope',
          json('PATCH', { enabled: true }),
        )
      ).status,
    ).toBe(404)

    expect(
      (await app().request(`/api/channels/${CHANNEL_ID}`, { method: 'DELETE' }))
        .status,
    ).toBe(204)
    expect(
      (
        await app(scope({ remove: vi.fn(async () => false) })).request(
          `/api/channels/${CHANNEL_ID}`,
          { method: 'DELETE' },
        )
      ).status,
    ).toBe(404)
    expect(
      (await app().request('/api/channels/nope', { method: 'DELETE' })).status,
    ).toBe(404)

    expect(
      (
        await app().request(`/api/channels/${CHANNEL_ID}/test`, {
          method: 'POST',
        })
      ).status,
    ).toBe(204)
    expect(
      (
        await app(scope({ test: vi.fn(async () => false) })).request(
          `/api/channels/${CHANNEL_ID}/test`,
          { method: 'POST' },
        )
      ).status,
    ).toBe(404)
    expect(
      (await app().request('/api/channels/nope/test', { method: 'POST' }))
        .status,
    ).toBe(404)
  })
})
