import { readFile } from 'node:fs/promises'
import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'
import { join, relative, resolve } from 'node:path'

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createClient } from '@supabase/supabase-js'
import { Hono } from 'hono'
import nodemailer from 'nodemailer'
import { WebSocketServer } from 'ws'

import {
  createApiFromEnvironment,
  runScheduledTick,
  type WorkerEnvironment,
} from './composition.ts'
import { SupabaseTenantSignature } from './features/live/adapters/outbound/tenant-live-hub.ts'
import { ConfigError, readNodeConfig } from './node/environment.ts'
import { LiveRegistry } from './node/live-registry.ts'
import { createMemoryRateLimitBinding } from './node/memory-rate-limit.ts'
import {
  buildContentSecurityPolicy,
  STATIC_SECURITY_HEADERS,
} from './node/static-security.ts'

const TICK_INTERVAL_MS = 60_000
const INTERNAL_CLIENT_IP_HEADER = 'x-cronping-client-ip'

function log(event: string, details: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ event, ...details }))
}

function rejectUpgrade(socket: Duplex, status: number) {
  socket.write(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`)
  socket.destroy()
}

async function main() {
  const config = readNodeConfig(process.env)
  const serviceClient = createClient(
    config.environment.SUPABASE_URL,
    config.environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      db: { timeout: 8_000 },
    },
  )
  const registry = new LiveRegistry({
    port: new SupabaseTenantSignature(serviceClient),
  })
  const clientIpHeader = config.clientIpHeader ?? INTERNAL_CLIENT_IP_HEADER
  const transport = config.smtp
    ? nodemailer.createTransport({
        auth:
          config.smtp.user && config.smtp.password
            ? { pass: config.smtp.password, user: config.smtp.user }
            : undefined,
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
      })
    : null
  const environment: WorkerEnvironment = {
    ...config.environment,
    AUTH_RATE_LIMITER: createMemoryRateLimitBinding({
      limit: 10,
      periodSeconds: 60,
    }),
    CLIENT_IP_HEADER: clientIpHeader,
    PING_RATE_LIMITER: createMemoryRateLimitBinding({
      limit: 120,
      periodSeconds: 60,
    }),
    TENANT_LIVE_HUB: registry.namespace,
    ...(transport ? { EMAIL_TRANSPORT: transport } : {}),
  }

  const webRoot = resolve(config.webRoot)
  const indexHtml = await readFile(join(webRoot, 'index.html'), 'utf8').catch(
    () => null,
  )
  const contentSecurityPolicy = indexHtml
    ? buildContentSecurityPolicy(indexHtml)
    : null
  const staticRoot = relative(process.cwd(), webRoot) || '.'

  const root = new Hono()

  root.use('*', async (context, next) => {
    await next()

    if (!context.req.path.startsWith('/api/')) {
      for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
        context.header(name, value)
      }

      if (contentSecurityPolicy) {
        context.header('Content-Security-Policy', contentSecurityPolicy)
      }
    }
  })
  root.route('/', createApiFromEnvironment(environment))
  root.all('/api/*', (context) =>
    context.json(
      { error: { code: 'not_found', message: 'Route not found' } },
      404,
    ),
  )

  if (indexHtml) {
    root.use('/*', serveStatic({ root: staticRoot }))
    root.get('*', serveStatic({ path: join(staticRoot, 'index.html') }))
  }

  const server = serve({
    fetch: (request, info) => {
      let forwarded = request

      if (!config.clientIpHeader) {
        // No trusted proxy configured: the socket address is the only reliable
        // client IP, and any client-supplied value is overwritten.
        const headers = new Headers(request.headers)

        headers.set(
          INTERNAL_CLIENT_IP_HEADER,
          info.incoming.socket.remoteAddress ?? 'unknown',
        )
        forwarded = new Request(request, { headers })
      }

      return root.fetch(forwarded, environment)
    },
    port: config.port,
  }) as Server

  const sockets = new WebSocketServer({ noServer: true })

  server.on(
    'upgrade',
    (incoming: IncomingMessage, socket: Duplex, head: Buffer) => {
      void (async () => {
        const url = new URL(incoming.url ?? '/', 'http://localhost')

        if (url.pathname !== '/api/live') {
          rejectUpgrade(socket, 404)

          return
        }

        const headers = new Headers()

        for (const [name, value] of Object.entries(incoming.headers)) {
          if (value !== undefined) {
            headers.set(name, Array.isArray(value) ? value.join(', ') : value)
          }
        }

        headers.set(
          INTERNAL_CLIENT_IP_HEADER,
          incoming.socket.remoteAddress ?? 'unknown',
        )

        // The regular route authenticates the session and checks the Origin;
        // here it answers 200 with the tenant id instead of upgrading.
        const response = await root.fetch(
          new Request(new URL('/api/live', config.environment.APP_ORIGIN), {
            headers,
            method: 'GET',
          }),
          environment,
        )

        if (response.status !== 200) {
          rejectUpgrade(socket, response.status)

          return
        }

        const tenantId = await response.text()

        sockets.handleUpgrade(incoming, socket, head, (webSocket) => {
          registry.add(tenantId, {
            onClose: (listener) => {
              webSocket.on('close', listener)
              webSocket.on('error', listener)
            },
            onMessage: (listener) =>
              webSocket.on('message', (data) => listener(data.toString())),
            send: (message) => webSocket.send(message),
          })
        })
      })().catch(() => rejectUpgrade(socket, 500))
    },
  )

  let running = false
  const ticker = setInterval(() => {
    if (running) {
      return
    }

    running = true
    runScheduledTick(environment)
      .catch(() => log('cron.failed'))
      .finally(() => {
        running = false
      })
  }, TICK_INTERVAL_MS)

  const shutdown = () => {
    clearInterval(ticker)
    sockets.close()
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 10_000).unref()
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  log('server.started', {
    email: transport
      ? 'smtp'
      : environment.RESEND_API_KEY
        ? 'resend'
        : 'disabled',
    port: config.port,
    signups: environment.SIGNUPS_ENABLED !== 'false',
    web: indexHtml ? 'served' : 'missing',
  })
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    console.error('Invalid configuration:')

    for (const problem of error.problems) {
      console.error(` - ${problem}`)
    }
  } else {
    console.error('The server could not start.')
  }

  process.exit(1)
})
