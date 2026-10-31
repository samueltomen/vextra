import { describe, expect, it, vi } from 'vitest'

import { Hono } from 'hono'

import { createApiDelegate } from './api-delegate.ts'
import { ConfigError, readNodeConfig } from './environment.ts'
import {
  LiveRegistry,
  type RegistrySocket,
  type Scheduler,
} from './live-registry.ts'
import { createMemoryRateLimitBinding } from './memory-rate-limit.ts'
import {
  buildContentSecurityPolicy,
  inlineScriptHashes,
} from './static-security.ts'

const SECRET = 'x'.repeat(40)
const BASE = {
  APP_ORIGIN: 'https://cronping.example.org',
  PING_TOKEN_PEPPER: SECRET,
  SESSION_ENCRYPTION_KEY: SECRET,
  SUPABASE_PUBLISHABLE_KEY: 'publishable',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  SUPABASE_URL: 'https://project.supabase.co',
}

describe('createMemoryRateLimitBinding', () => {
  it('allows up to the limit per key and window, then blocks', async () => {
    let now = 0
    const binding = createMemoryRateLimitBinding({
      limit: 2,
      nowMs: () => now,
      periodSeconds: 60,
    })

    expect(await binding.limit({ key: 'a' })).toEqual({ success: true })
    expect(await binding.limit({ key: 'a' })).toEqual({ success: true })
    expect(await binding.limit({ key: 'a' })).toEqual({ success: false })
    expect(await binding.limit({ key: 'b' })).toEqual({ success: true })

    now = 60_000
    expect(await binding.limit({ key: 'a' })).toEqual({ success: true })
  })

  it('forgets expired windows when it grows large', async () => {
    let now = 0
    const binding = createMemoryRateLimitBinding({
      limit: 1,
      nowMs: () => now,
      periodSeconds: 1,
    })

    for (let index = 0; index < 10_001; index += 1) {
      await binding.limit({ key: `k${index}` })
    }

    now = 5_000
    expect(await binding.limit({ key: 'k0' })).toEqual({ success: true })
    expect(await binding.limit({ key: 'k0' })).toEqual({ success: false })
  })
})

describe('readNodeConfig', () => {
  it('reads a minimal configuration with sensible defaults', () => {
    const config = readNodeConfig(BASE)

    expect(config.port).toBe(8787)
    expect(config.webRoot).toBe('./web')
    expect(config.smtp).toBeNull()
    expect(config.clientIpHeader).toBeNull()
    expect(config.environment.APP_ORIGIN).toBe('https://cronping.example.org')
    expect(config.environment.RESEND_API_KEY).toBeUndefined()
  })

  it('lists every missing or weak value at once', () => {
    try {
      readNodeConfig({
        APP_ORIGIN: 'not a url',
        PING_TOKEN_PEPPER: 'short',
      })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError)
      expect((error as ConfigError).problems).toEqual(
        expect.arrayContaining([
          'APP_ORIGIN must be a valid URL',
          'SUPABASE_URL is required',
          'SUPABASE_PUBLISHABLE_KEY is required',
          'SUPABASE_SERVICE_ROLE_KEY is required',
          'SESSION_ENCRYPTION_KEY is required',
          'PING_TOKEN_PEPPER must be at least 32 characters',
        ]),
      )
    }
  })

  it('validates the port', () => {
    expect(() => readNodeConfig({ ...BASE, PORT: '99999' })).toThrow(
      ConfigError,
    )
    expect(readNodeConfig({ ...BASE, PORT: '3000' }).port).toBe(3000)
  })

  it('configures Resend with its sender address', () => {
    const config = readNodeConfig({
      ...BASE,
      RESEND_API_KEY: 're_key',
      RESEND_FROM_EMAIL: 'CronPing <a@example.org>',
    })

    expect(config.environment.RESEND_API_KEY).toBe('re_key')
    expect(config.smtp).toBeNull()
    expect(() => readNodeConfig({ ...BASE, RESEND_API_KEY: 're_key' })).toThrow(
      ConfigError,
    )
  })

  it('infers SMTP from the host and validates its settings', () => {
    const config = readNodeConfig({
      ...BASE,
      EMAIL_FROM: 'CronPing <a@example.org>',
      SMTP_HOST: 'smtp.example.org',
      SMTP_PASSWORD: 'pw',
      SMTP_PORT: '465',
      SMTP_USER: 'user',
    })

    expect(config.smtp).toEqual({
      host: 'smtp.example.org',
      password: 'pw',
      port: 465,
      secure: true,
      user: 'user',
    })
    expect(config.environment.EMAIL_FROM).toBe('CronPing <a@example.org>')

    const problems = (overrides: Record<string, string>) => {
      try {
        readNodeConfig({ ...BASE, SMTP_HOST: 'smtp.example.org', ...overrides })
      } catch (error) {
        return (error as ConfigError).problems
      }

      return []
    }

    expect(problems({})).toContain(
      'EMAIL_FROM is required to send e-mail through SMTP',
    )
    expect(
      problems({ EMAIL_FROM: 'a@example.org', SMTP_USER: 'user' }),
    ).toContain('SMTP_USER and SMTP_PASSWORD must be set together')
    expect(
      problems({ EMAIL_FROM: 'a@example.org', SMTP_PORT: 'abc' }),
    ).toContain('SMTP_PORT must be an integer between 1 and 65535')
  })

  it('lets EMAIL_PROVIDER choose and rejects unknown providers', () => {
    expect(() => readNodeConfig({ ...BASE, EMAIL_PROVIDER: 'smtp' })).toThrow(
      ConfigError,
    )
    expect(() => readNodeConfig({ ...BASE, EMAIL_PROVIDER: 'sms' })).toThrow(
      ConfigError,
    )

    const forced = readNodeConfig({
      ...BASE,
      EMAIL_FROM: 'a@example.org',
      EMAIL_PROVIDER: 'smtp',
      RESEND_API_KEY: 're_key',
      RESEND_FROM_EMAIL: 'a@example.org',
      SMTP_HOST: 'smtp.example.org',
    })

    expect(forced.smtp?.host).toBe('smtp.example.org')
    expect(forced.environment.RESEND_API_KEY).toBeUndefined()
  })

  it('reads the proxy header and the registration switch', () => {
    const config = readNodeConfig({
      ...BASE,
      CLIENT_IP_HEADER: 'X-Forwarded-For',
      SIGNUPS_ENABLED: 'false',
      WEB_ROOT: '/srv/web',
    })

    expect(config.clientIpHeader).toBe('x-forwarded-for')
    expect(config.environment.SIGNUPS_ENABLED).toBe('false')
    expect(config.webRoot).toBe('/srv/web')
  })
})

describe('LiveRegistry', () => {
  function fakeSocket() {
    const listeners: {
      close?: () => void
      message?: (message: string) => void
    } = {}
    const socket: RegistrySocket = {
      onClose: (listener) => {
        listeners.close = listener
      },
      onMessage: (listener) => {
        listeners.message = listener
      },
      send: vi.fn(),
    }

    return { listeners, socket }
  }

  function fakeScheduler() {
    const tasks: Array<() => void> = []
    const scheduler: Scheduler = {
      clear: vi.fn(),
      every: (_interval, task) => {
        tasks.push(task)

        return tasks.length
      },
    }

    return { scheduler, tasks }
  }

  it('echoes the tenant id through the Durable Object stand-in', async () => {
    const registry = new LiveRegistry({ port: { read: async () => '' } })
    const stub = registry.namespace.get(registry.namespace.idFromName('t1'))
    const response = await stub.fetch(
      new Request('https://hub.test', { headers: { 'x-tenant-id': 't1' } }),
    )

    expect(await response.text()).toBe('t1')
  })

  it('greets, answers pings and pushes changes to connected clients', async () => {
    const read = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('a')
      .mockResolvedValueOnce('b')
    const { scheduler, tasks } = fakeScheduler()
    const registry = new LiveRegistry({ port: { read }, scheduler })
    const { listeners, socket } = fakeSocket()

    registry.add('t1', socket)
    expect(socket.send).toHaveBeenCalledWith('ready')
    listeners.message?.('ping')
    expect(socket.send).toHaveBeenCalledWith('pong')
    expect(tasks).toHaveLength(1)

    tasks[0]?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(read).toHaveBeenCalledTimes(1)
    tasks[0]?.()
    await vi.waitFor(() => expect(socket.send).toHaveBeenCalledWith('changed'))
  })

  it('shares one timer per tenant and stops it with the last client', () => {
    const { scheduler, tasks } = fakeScheduler()
    const registry = new LiveRegistry({
      port: { read: async () => '' },
      scheduler,
    })
    const first = fakeSocket()
    const second = fakeSocket()

    registry.add('t1', first.socket)
    registry.add('t1', second.socket)
    expect(tasks).toHaveLength(1)
    expect(registry.tenantCount).toBe(1)

    first.listeners.close?.()
    expect(registry.tenantCount).toBe(1)
    expect(scheduler.clear).not.toHaveBeenCalled()

    second.listeners.close?.()
    expect(registry.tenantCount).toBe(0)
    expect(scheduler.clear).toHaveBeenCalledTimes(1)
  })

  it('does not overlap two polls of the same tenant', async () => {
    let release: (value: string) => void = () => undefined
    const read = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve
        }),
    )
    const { scheduler, tasks } = fakeScheduler()
    const registry = new LiveRegistry({ port: { read }, scheduler })

    registry.add('t1', fakeSocket().socket)
    tasks[0]?.()
    tasks[0]?.()
    expect(read).toHaveBeenCalledTimes(1)
    release('a')
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1))
  })
})

describe('content security policy', () => {
  const HTML = `<html><head>
    <script>window.theme = 'dark'</script>
    <script src="/assets/app.js"></script>
    <script>   </script>
  </head></html>`

  it('hashes only the non-empty inline scripts', () => {
    const hashes = inlineScriptHashes(HTML)

    expect(hashes).toHaveLength(1)
    expect(hashes[0]).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/u)
  })

  it('allows inline scripts by hash only and forbids framing', () => {
    const policy = buildContentSecurityPolicy(HTML)

    expect(policy).toContain("default-src 'self'")
    expect(policy).toMatch(/script-src 'self' 'sha256-[^']+'/u)
    expect(policy).not.toContain("'unsafe-eval'")
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/u)
    expect(policy).toContain("frame-ancestors 'none'")
  })
})

describe('createApiDelegate', () => {
  it('builds a fresh API for every request so no client outlives a request', async () => {
    let built = 0
    const createApi = () => {
      built += 1
      const instance = built

      return new Hono().get('/api/who', (context) => context.json({ instance }))
    }
    const root = new Hono()

    root.all('/api/*', createApiDelegate(createApi, {}))

    const first = await root.request('/api/who')
    const second = await root.request('/api/who')

    expect(await first.json()).toEqual({ instance: 1 })
    expect(await second.json()).toEqual({ instance: 2 })
  })

  it('answers unknown API routes in JSON and leaves other responses alone', async () => {
    const root = new Hono()

    root.all(
      '/api/*',
      createApiDelegate(
        () =>
          new Hono().get('/api/known', (context) => context.json({ ok: 1 })),
        {},
      ),
    )

    const unknown = await root.request('/api/nope')

    expect(unknown.status).toBe(404)
    await expect(unknown.json()).resolves.toEqual({
      error: { code: 'not_found', message: 'Route not found' },
    })
    expect((await root.request('/api/known')).status).toBe(200)
  })
})
