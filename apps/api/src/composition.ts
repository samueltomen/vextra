import { createClient } from '@supabase/supabase-js'
import type { Context } from 'hono'

import { createApiApp } from './app.ts'
import { AccountService } from './features/accounts/application/account-service.ts'
import { DeleteAccount } from './features/accounts/application/delete-account.ts'
import { createAuthRoutes } from './features/accounts/adapters/inbound/http/auth-routes.ts'
import { createAccountRoutes } from './features/accounts/adapters/inbound/http/account-routes.ts'
import {
  clearSessionCookie,
  readSessionCookie,
  writeSessionCookie,
} from './features/accounts/adapters/inbound/http/session-cookies.ts'
import { SessionCookieCodec } from './features/accounts/adapters/outbound/session-cookie.ts'
import { SupabaseAccountDeletion } from './features/accounts/adapters/outbound/supabase-account-deletion.ts'
import { SupabaseAccountsGateway } from './features/accounts/adapters/outbound/supabase-accounts-gateway.ts'
import {
  createMonitorRoutes,
  type AuthenticatedMonitorScope,
} from './features/monitoring/adapters/inbound/http/monitor-routes.ts'
import { createPingRoutes } from './features/monitoring/adapters/inbound/http/ping-route.ts'
import {
  WebCryptoMonitorTokenGenerator,
  hashMonitorToken,
} from './features/monitoring/adapters/outbound/crypto-monitor-token.ts'
import { SupabaseDueMonitorClaimer } from './features/monitoring/adapters/outbound/supabase-due-monitor-claimer.ts'
import { SupabaseHeartbeatRecorder } from './features/monitoring/adapters/outbound/supabase-heartbeat-recorder.ts'
import {
  SupabaseMonitorIncidentRepository,
  type MonitorIncidentQueryClient,
} from './features/monitoring/adapters/outbound/supabase-monitor-incident-repository.ts'
import {
  SupabaseMonitorLifecycle,
  type MonitorLifecycleRpcClient,
} from './features/monitoring/adapters/outbound/supabase-monitor-lifecycle.ts'
import {
  SupabaseMonitorTokenRotation,
  type MonitorTokenRotationRpcClient,
} from './features/monitoring/adapters/outbound/supabase-monitor-token-rotation.ts'
import { SupabaseMonitorRepository } from './features/monitoring/adapters/outbound/supabase-monitor-repository.ts'
import {
  SupabaseMonitorQueryRepository,
  type MonitorQueryClient,
} from './features/monitoring/adapters/outbound/supabase-monitor-query-repository.ts'
import { CheckDueMonitors } from './features/monitoring/application/check-due-monitors.ts'
import { CreateMonitor } from './features/monitoring/application/create-monitor.ts'
import { MonitorIncidents } from './features/monitoring/application/monitor-incidents.ts'
import { MonitorLifecycle } from './features/monitoring/application/monitor-lifecycle.ts'
import { MonitorReadService } from './features/monitoring/application/monitor-read.ts'
import { RecordHeartbeat } from './features/monitoring/application/record-heartbeat.ts'
import { RotateMonitorToken } from './features/monitoring/application/rotate-monitor-token.ts'
import { DeliverNotifications } from './features/notifications/application/deliver-notifications.ts'
import { NotificationHistory } from './features/notifications/application/notification-history.ts'
import { createNotificationRoutes } from './features/notifications/adapters/inbound/http/notification-routes.ts'
import { ResendNotificationSender } from './features/notifications/adapters/outbound/resend-notification-sender.ts'
import {
  SupabaseNotificationDeliveryQueue,
  type NotificationDeliveryRpcClient,
} from './features/notifications/adapters/outbound/supabase-notification-delivery-queue.ts'
import {
  SupabaseNotificationHistory,
  type NotificationHistoryQueryClient,
} from './features/notifications/adapters/outbound/supabase-notification-history.ts'

export type WorkerEnvironment = Readonly<{
  APP_ORIGIN: string
  PING_TOKEN_PEPPER: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
  SESSION_ENCRYPTION_KEY: string
  SUPABASE_PUBLISHABLE_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
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

function createServiceSupabaseClient(environment: WorkerEnvironment) {
  return createClient(
    environment.SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      db: {
        timeout: 8_000,
      },
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
  const recordHeartbeat = new RecordHeartbeat({
    hashToken: (token) =>
      hashMonitorToken(token, environment.PING_TOKEN_PEPPER),
    recorder: new SupabaseHeartbeatRecorder(supabase),
  })

  const resolveSession = async (context: Context) => {
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

    return { account, client }
  }

  const authenticateMonitor = async (
    context: Context,
  ): Promise<AuthenticatedMonitorScope | null> => {
    const session = await resolveSession(context)

    if (!session) {
      return null
    }

    const { account, client } = session
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
      monitorIncidents: new MonitorIncidents(
        new SupabaseMonitorIncidentRepository(
          client as unknown as MonitorIncidentQueryClient,
        ),
      ),
      monitorLifecycle: new MonitorLifecycle(
        new SupabaseMonitorLifecycle(
          client as unknown as MonitorLifecycleRpcClient,
        ),
      ),
      monitorRead: new MonitorReadService(
        new SupabaseMonitorQueryRepository(
          client as unknown as MonitorQueryClient,
        ),
      ),
      principal: {
        tenantId: account.tenantId,
        userId: account.user.id,
      },
      rotateToken: new RotateMonitorToken({
        generator: tokenGenerator,
        port: new SupabaseMonitorTokenRotation(
          client as unknown as MonitorTokenRotationRpcClient,
        ),
      }),
    }
  }

  const authenticateNotifications = async (context: Context) => {
    const session = await resolveSession(context)

    if (!session) {
      return null
    }

    return {
      history: new NotificationHistory(
        new SupabaseNotificationHistory(
          session.client as unknown as NotificationHistoryQueryClient,
        ),
      ),
      tenantId: session.account.tenantId,
    }
  }

  const authenticateAccount = async (context: Context) => {
    const session = await resolveSession(context)

    if (!session) {
      return null
    }

    return {
      deleteAccount: new DeleteAccount(
        new SupabaseAccountDeletion(createServiceSupabaseClient(environment)),
      ),
      userId: session.account.user.id,
    }
  }

  return createApiApp({
    accountRoutes: createAccountRoutes({
      authenticate: authenticateAccount,
    }),
    allowedOrigin: environment.APP_ORIGIN,
    authRoutes: createAuthRoutes({ accounts, codec }),
    monitorRoutes: createMonitorRoutes({ authenticate: authenticateMonitor }),
    notificationRoutes: createNotificationRoutes({
      authenticate: authenticateNotifications,
    }),
    pingRoutes: createPingRoutes({
      execute: (token) => recordHeartbeat.execute(token),
    }),
  })
}

export async function runScheduledCheck(
  environment: WorkerEnvironment,
  batchSize = 100,
): Promise<number> {
  const client = createServiceSupabaseClient(environment)
  const checker = new CheckDueMonitors({
    claimer: new SupabaseDueMonitorClaimer(client),
  })

  return checker.execute(batchSize)
}

export async function runNotificationDelivery(
  environment: WorkerEnvironment,
  batchSize = 10,
) {
  if (!environment.RESEND_API_KEY || !environment.RESEND_FROM_EMAIL) {
    return null
  }

  const client = createServiceSupabaseClient(environment)
  const deliver = new DeliverNotifications({
    queue: new SupabaseNotificationDeliveryQueue(
      client as unknown as NotificationDeliveryRpcClient,
    ),
    sender: new ResendNotificationSender({
      apiKey: environment.RESEND_API_KEY,
      from: environment.RESEND_FROM_EMAIL,
    }),
  })

  return deliver.execute(batchSize)
}
