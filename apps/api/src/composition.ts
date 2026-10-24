import { createClient } from '@supabase/supabase-js'
import type { Context } from 'hono'

import { createApiApp } from './app.ts'
import { AccountService } from './features/accounts/application/account-service.ts'
import { createAuthRoutes } from './features/accounts/adapters/inbound/http/auth-routes.ts'
import {
  clearSessionCookie,
  readSessionCookie,
  writeSessionCookie,
} from './features/accounts/adapters/inbound/http/session-cookies.ts'
import { SessionCookieCodec } from './features/accounts/adapters/outbound/session-cookie.ts'
import { SupabaseAccountsGateway } from './features/accounts/adapters/outbound/supabase-accounts-gateway.ts'
import { CreateMonitor } from './features/monitoring/application/create-monitor.ts'
import { MonitorReadService } from './features/monitoring/application/monitor-read.ts'
import {
  createMonitorRoutes,
  type AuthenticatedMonitorScope,
} from './features/monitoring/adapters/inbound/http/monitor-routes.ts'
import { WebCryptoMonitorTokenGenerator } from './features/monitoring/adapters/outbound/crypto-monitor-token.ts'
import { SupabaseMonitorRepository } from './features/monitoring/adapters/outbound/supabase-monitor-repository.ts'
import {
  SupabaseMonitorQueryRepository,
  type MonitorQueryClient,
} from './features/monitoring/adapters/outbound/supabase-monitor-query-repository.ts'

export type WorkerEnvironment = Readonly<{
  APP_ORIGIN: string
  PING_TOKEN_PEPPER: string
  SESSION_ENCRYPTION_KEY: string
  SUPABASE_PUBLISHABLE_KEY: string
  SUPABASE_URL: string
}>

function createSupabaseClient(
  environment: WorkerEnvironment,
  accessToken?: string,
) {
  return createClient(
    environment.SUPABASE_URL,
    environment.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      db: {
        timeout: 8_000,
      },
      ...(accessToken
        ? {
            global: {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          }
        : {}),
    },
  )
}

export function createApiFromEnvironment(environment: WorkerEnvironment) {
  const codec = new SessionCookieCodec(environment.SESSION_ENCRYPTION_KEY)
  const supabase = createSupabaseClient(environment)
  const userClient = (accessToken: string) =>
    createSupabaseClient(environment, accessToken)
  const accounts = new AccountService({
    clock: { nowMs: () => Date.now() },
    gateway: new SupabaseAccountsGateway(supabase, userClient),
  })
  const tokenGenerator = new WebCryptoMonitorTokenGenerator(
    environment.PING_TOKEN_PEPPER,
  )

  const authenticateMonitor = async (
    context: Context,
  ): Promise<AuthenticatedMonitorScope | null> => {
    const tokens = await readSessionCookie(context, codec)

    if (!tokens) {
      return null
    }

    const account = await accounts.authenticate(tokens)

    if (!account) {
      clearSessionCookie(context)
      return null
    }

    if (account.refreshed) {
      await writeSessionCookie(context, codec, account.tokens)
    }

    const client = userClient(account.tokens.accessToken)
    const createMonitorUseCase = new CreateMonitor({
      clock: { nowMs: () => Date.now() },
      idGenerator: { generate: () => crypto.randomUUID() },
      repository: new SupabaseMonitorRepository(client),
      tokenGenerator,
    })

    return {
      createMonitor: {
        execute: async (input) => {
          const result = await createMonitorUseCase.execute(input)

          if (result.monitor.tenantId !== account.tenantId) {
            throw new Error('monitor tenant mismatch')
          }

          return result
        },
      },
      monitorRead: new MonitorReadService(
        new SupabaseMonitorQueryRepository(
          client as unknown as MonitorQueryClient,
        ),
      ),
      principal: {
        tenantId: account.tenantId,
        userId: account.user.id,
      },
    }
  }

  return createApiApp({
    allowedOrigin: environment.APP_ORIGIN,
    authRoutes: createAuthRoutes({ accounts, codec }),
    monitorRoutes: createMonitorRoutes({ authenticate: authenticateMonitor }),
  })
}
