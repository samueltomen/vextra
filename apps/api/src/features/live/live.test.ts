import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { LiveHub } from './application/live-hub.ts'
import { createLiveRoutes } from './adapters/inbound/http/live-routes.ts'
import {
  SupabaseTenantSignature,
  TenantLiveHub,
} from './adapters/outbound/tenant-live-hub.ts'

function socket() {
  return { close: vi.fn(), send: vi.fn() }
}

describe('LiveHub', () => {
  it('greets a new client and answers pings', () => {
    const hub = new LiveHub({ read: async () => '' })
    const client = socket()

    hub.onConnect(client)
    hub.onMessage(client, 'ping')
    hub.onMessage(client, 'noise')

    expect(client.send.mock.calls).toEqual([['ready'], ['pong']])
  })

  it('notifies every client only when the tenant fingerprint changes', async () => {
    const read = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('a')
      .mockResolvedValueOnce('a')
      .mockResolvedValueOnce('b')
    const hub = new LiveHub({ read })
    const first = socket()
    const second = socket()

    expect(await hub.tick('t', [first, second])).toBe(true)
    expect(await hub.tick('t', [first, second])).toBe(true)
    expect(first.send).not.toHaveBeenCalled()

    expect(await hub.tick('t', [first, second])).toBe(true)
    expect(first.send).toHaveBeenCalledWith('changed')
    expect(second.send).toHaveBeenCalledWith('changed')
  })

  it('stops polling and forgets the baseline when nobody is connected', async () => {
    const read = vi.fn(async () => 'a')
    const hub = new LiveHub({ read })
    const client = socket()

    await hub.tick('t', [client])

    expect(await hub.tick('t', [])).toBe(false)

    await hub.tick('t', [client])
    read.mockResolvedValue('b')
    await hub.tick('t', [client])

    expect(client.send).toHaveBeenCalledTimes(1)
  })

  it('keeps polling after a read failure and survives closed sockets', async () => {
    const read = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('a')
      .mockRejectedValueOnce(new Error('db'))
      .mockResolvedValueOnce('b')
    const hub = new LiveHub({ read })
    const broken = {
      send: vi.fn(() => {
        throw new Error('closed')
      }),
    }

    await hub.tick('t', [broken])

    expect(await hub.tick('t', [broken])).toBe(true)
    await expect(hub.tick('t', [broken])).resolves.toBe(true)
  })
})

describe('GET /api/live', () => {
  function app(
    overrides: Partial<Parameters<typeof createLiveRoutes>[0]> = {},
  ) {
    return createLiveRoutes({
      allowedOrigin: 'https://app.example.test',
      authenticate: async () => ({ tenantId: 'tenant-a' }),
      connect: async () => new Response('connected', { status: 200 }),
      ...overrides,
    })
  }

  const upgrade = { origin: 'https://app.example.test', upgrade: 'websocket' }

  it('requires a WebSocket upgrade', async () => {
    expect((await app().request('/api/live')).status).toBe(426)
  })

  it('rejects a foreign or missing origin before authenticating', async () => {
    const authenticate = vi.fn(async () => ({ tenantId: 'tenant-a' }))
    const response = await app({ authenticate }).request('/api/live', {
      headers: { origin: 'https://evil.test', upgrade: 'websocket' },
    })

    expect(response.status).toBe(403)
    expect(authenticate).not.toHaveBeenCalled()
    expect(
      (
        await app().request('/api/live', {
          headers: { upgrade: 'websocket' },
        })
      ).status,
    ).toBe(403)
  })

  it('requires a session and hands the session tenant to the hub', async () => {
    expect(
      (
        await app({ authenticate: async () => null }).request('/api/live', {
          headers: upgrade,
        })
      ).status,
    ).toBe(401)

    const connect = vi.fn(async () => new Response('ok'))
    const response = await app({ connect }).request('/api/live', {
      headers: { ...upgrade, 'x-tenant-id': 'tenant-b' },
    })

    expect(response.status).toBe(200)
    expect(connect).toHaveBeenCalledWith('tenant-a', expect.any(Request))
  })

  it('hides connection failures', async () => {
    const response = await app({
      connect: async () => {
        throw new Error('boom')
      },
    }).request('/api/live', { headers: upgrade })

    expect(response.status).toBe(500)
  })
})

function client(monitors: object, outbox: object) {
  const filters: Array<[string, unknown[]]> = []
  const builder = (result: object) => {
    const chain: Record<string, unknown> = {}

    for (const method of ['select', 'eq', 'order', 'limit']) {
      chain[method] = vi.fn((...args: unknown[]) => {
        filters.push([method, args])

        return chain
      })
    }

    chain['then'] = (resolve: (value: object) => unknown) =>
      Promise.resolve(result).then(resolve)

    return chain
  }

  return {
    filters,
    supabase: {
      from: (table: string) =>
        builder(table === 'monitors' ? monitors : outbox),
    } as unknown as SupabaseClient,
  }
}

describe('SupabaseTenantSignature', () => {
  const row = {
    alert_at: '2026-10-31T12:00:00Z',
    folder_id: null,
    id: 'm1',
    last_heartbeat_at: null,
    paused_at: null,
    status: 'healthy',
    total_pings: 1,
    updated_at: '2026-10-31T11:00:00Z',
  }

  it('changes when a monitor or a notification changes, scoped to the tenant', async () => {
    const read = async (
      status: string,
      outboxStatus: string,
    ): Promise<string> => {
      const { filters, supabase } = client(
        { data: [{ ...row, status }], error: null },
        {
          data: [{ attempts: 1, id: 'o1', status: outboxStatus }],
          error: null,
        },
      )
      const signature = await new SupabaseTenantSignature(supabase).read(
        'tenant-a',
      )

      expect(filters).toContainEqual(['eq', ['tenant_id', 'tenant-a']])

      return signature
    }

    const base = await read('healthy', 'sent')

    expect(await read('healthy', 'sent')).toBe(base)
    expect(await read('late', 'sent')).not.toBe(base)
    expect(await read('healthy', 'failed')).not.toBe(base)
  })

  it('fails closed on database errors', async () => {
    const { supabase } = client(
      { data: null, error: { code: 'x' } },
      { data: [], error: null },
    )

    await expect(
      new SupabaseTenantSignature(supabase).read('t'),
    ).rejects.toThrow('live signature query failed')
  })
})

describe('TenantLiveHub', () => {
  function create() {
    const storage = new Map<string, unknown>()
    const sockets = [socket()]
    const setAlarm = vi.fn(async () => undefined)
    const hub = new TenantLiveHub(
      {
        acceptWebSocket: vi.fn(),
        getWebSockets: () => sockets,
        storage: {
          get: async <T>(key: string) => storage.get(key) as T | undefined,
          put: async (key: string, value: unknown) => {
            storage.set(key, value)
          },
          setAlarm,
        },
      },
      { SUPABASE_SERVICE_ROLE_KEY: 'key', SUPABASE_URL: 'http://127.0.0.1:1' },
    )

    return { hub, setAlarm, sockets, storage }
  }

  it('refuses requests that are not a tenant WebSocket upgrade', async () => {
    const { hub } = create()

    expect((await hub.fetch(new Request('https://hub.test/'))).status).toBe(426)
    expect(
      (
        await hub.fetch(
          new Request('https://hub.test/', {
            headers: { upgrade: 'websocket' },
          }),
        )
      ).status,
    ).toBe(426)
  })

  it('does nothing on an alarm without a known tenant', async () => {
    const { hub, setAlarm } = create()

    await hub.alarm()

    expect(setAlarm).not.toHaveBeenCalled()
  })

  it('answers pings and closes sockets cleanly', () => {
    const { hub, sockets } = create()
    const client = sockets[0]!

    hub.webSocketMessage(client, 'ping')
    hub.webSocketMessage(client, new ArrayBuffer(1))
    hub.webSocketClose(client, 1005)

    expect(client.send).toHaveBeenCalledWith('pong')
    expect(client.close).toHaveBeenCalledWith(1000)
  })
})
