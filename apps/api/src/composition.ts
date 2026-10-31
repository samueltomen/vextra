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
import {
  SupabaseHeartbeatRecorder,
  SupabaseRunEventRecorder,
} from './features/monitoring/adapters/outbound/supabase-heartbeat-recorder.ts'
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
import { SupabaseCronDeadlines } from './features/monitoring/adapters/outbound/supabase-cron-deadlines.ts'
import { RefineCronDeadlines } from './features/monitoring/application/refine-cron-deadlines.ts'
import { UpdateMonitorSchedule } from './features/monitoring/application/update-monitor-schedule.ts'
import {
  SupabaseMonitorSchedule,
  type MonitorScheduleRpcClient,
} from './features/monitoring/adapters/outbound/supabase-monitor-schedule.ts'
import {
  ManageStatusPage,
  ReadPublicStatusPage,
} from './features/statuspage/application/status-page.ts'
import { createStatusPageRoutes } from './features/statuspage/adapters/inbound/http/status-page-routes.ts'
import {
  SupabasePublicStatusPage,
  SupabaseStatusPageSettings,
} from './features/statuspage/adapters/outbound/supabase-status-page.ts'
import { ManageMaintenance } from './features/maintenance/application/maintenance.ts'
import { createMaintenanceRoutes } from './features/maintenance/adapters/inbound/http/maintenance-routes.ts'
import { SupabaseMaintenance } from './features/maintenance/adapters/outbound/supabase-maintenance.ts'
import {
  AuthenticateApiKey,
  ManageApiKeys,
} from './features/apikeys/application/api-keys.ts'
import { createApiKeyRoutes } from './features/apikeys/adapters/inbound/http/api-key-routes.ts'
import { CryptoApiKeyGenerator } from './features/apikeys/adapters/outbound/crypto-api-key-generator.ts'
import {
  SupabaseApiKeyAuthenticator,
  SupabaseApiKeyStore,
} from './features/apikeys/adapters/outbound/supabase-api-keys.ts'
import { ManageTeam } from './features/team/application/team.ts'
import { createTeamRoutes } from './features/team/adapters/inbound/http/team-routes.ts'
import { CryptoInvitationToken } from './features/team/adapters/outbound/crypto-invitation-token.ts'
import { SupabaseTeamStore } from './features/team/adapters/outbound/supabase-team.ts'
import { MonitorReadService } from './features/monitoring/application/monitor-read.ts'
import {
  RecordHeartbeat,
  RecordRunEvent,
} from './features/monitoring/application/record-heartbeat.ts'
import { RotateMonitorToken } from './features/monitoring/application/rotate-monitor-token.ts'
import { DeliverNotifications } from './features/notifications/application/deliver-notifications.ts'
import { NotificationHistory } from './features/notifications/application/notification-history.ts'
import { createNotificationRoutes } from './features/notifications/adapters/inbound/http/notification-routes.ts'
import { MonitorMetricsService } from './features/monitoring/application/monitor-metrics.ts'
import { SupabaseMonitorMetrics } from './features/monitoring/adapters/outbound/supabase-monitor-metrics.ts'
import { createChannelRoutes } from './features/channels/adapters/inbound/http/channel-routes.ts'
import { HttpChannelSender } from './features/channels/adapters/outbound/http-channel-sender.ts'
import {
  SupabaseChannelDeliveryQueue,
  SupabaseChannelRepository,
  SupabaseChannelSecrets,
  SupabaseIncidentReminders,
} from './features/channels/adapters/outbound/supabase-channels.ts'
import {
  DeliverChannelAlerts,
  EnqueueIncidentReminders,
  ManageChannels,
} from './features/channels/application/channels.ts'
import { createLiveRoutes } from './features/live/adapters/inbound/http/live-routes.ts'
import { createWorkspaceRoutes } from './features/workspace/adapters/inbound/http/workspace-routes.ts'
import {
  SupabaseFolderRepository,
  SupabaseMonitorDetailsRepository,
  SupabasePreferencesRepository,
} from './features/workspace/adapters/outbound/supabase-workspace.ts'
import {
  AccountPreferencesService,
  ManageFolders,
  ManageMonitorDetails,
} from './features/workspace/application/workspace.ts'
import {
  SmtpNotificationSender,
  SmtpWeeklyReportSender,
  type MailTransport,
} from './features/notifications/adapters/outbound/smtp-email-senders.ts'
import { SupabaseWeeklyReportQueue } from './features/notifications/adapters/outbound/supabase-weekly-report-queue.ts'
import { SendWeeklyReports } from './features/notifications/application/send-weekly-reports.ts'
import {
  ResendNotificationSender,
  ResendWeeklyReportSender,
} from './features/notifications/adapters/outbound/resend-notification-sender.ts'
import {
  SupabaseNotificationDeliveryQueue,
  type NotificationDeliveryRpcClient,
} from './features/notifications/adapters/outbound/supabase-notification-delivery-queue.ts'
import {
  SupabaseNotificationHistory,
  type NotificationHistoryQueryClient,
} from './features/notifications/adapters/outbound/supabase-notification-history.ts'

import {
  createCloudflareRateLimiter,
  type RateLimitBinding,
} from './rate-limit/rate-limit-guard.ts'

export type TenantLiveHubNamespace = Readonly<{
  get: (
    id: unknown,
  ) => Readonly<{ fetch: (request: Request) => Promise<Response> }>
  idFromName: (name: string) => unknown
}>

export type WorkerEnvironment = Readonly<{
  APP_ORIGIN: string
  PING_TOKEN_PEPPER: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
  SESSION_ENCRYPTION_KEY: string
  SUPABASE_PUBLISHABLE_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SUPABASE_URL: string
  AUTH_RATE_LIMITER?: RateLimitBinding
  CLIENT_IP_HEADER?: string
  EMAIL_FROM?: string
  EMAIL_TRANSPORT?: MailTransport
  SIGNUPS_ENABLED?: string
  TENANT_LIVE_HUB?: TenantLiveHubNamespace
  PING_RATE_LIMITER?: RateLimitBinding
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

  const recordRunEvent = new RecordRunEvent({
    hashToken: (token) =>
      hashMonitorToken(token, environment.PING_TOKEN_PEPPER),
    recorder: new SupabaseRunEventRecorder(supabase),
  })

  // One resolution per request: refreshing a session twice would reuse a
  // rotated refresh token, and the write guard and the route both need it.
  const sessions = new WeakMap<Request, ReturnType<typeof resolveSessionOnce>>()
  const resolveSession = (context: Context) => {
    const cached = sessions.get(context.req.raw)

    if (cached) {
      return cached
    }

    const pending = resolveSessionOnce(context)

    sessions.set(context.req.raw, pending)

    return pending
  }

  async function resolveSessionOnce(context: Context) {
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

  const invitationTokens = new CryptoInvitationToken(
    environment.PING_TOKEN_PEPPER,
  )
  const authenticateTeam = async (context: Context) => {
    const session = await resolveSession(context)

    if (!session) {
      return null
    }

    return {
      role: session.account.role,
      team: new ManageTeam({
        store: new SupabaseTeamStore(session.client),
        tokens: invitationTokens,
      }),
      tenantId: session.account.tenantId,
      userId: session.account.user.id,
    }
  }

  /** Viewers are read-only: refuse unsafe methods before any handler runs. */
  const canWrite = async (context: Context) => {
    const session = await resolveSession(context)

    return session === null || session.account.role !== 'viewer'
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
      monitorMetrics: new MonitorMetricsService({
        nowMs: () => Date.now(),
        port: new SupabaseMonitorMetrics(client),
      }),
      monitorRead: new MonitorReadService(
        new SupabaseMonitorQueryRepository(
          client as unknown as MonitorQueryClient,
        ),
      ),
      monitorSchedule: new UpdateMonitorSchedule({
        nowMs: () => Date.now(),
        port: new SupabaseMonitorSchedule(
          client as unknown as MonitorScheduleRpcClient,
        ),
      }),
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

  const authenticateWorkspace = async (context: Context) => {
    const session = await resolveSession(context)

    if (!session) {
      return null
    }

    return {
      details: new ManageMonitorDetails(
        new SupabaseMonitorDetailsRepository(session.client),
      ),
      folders: new ManageFolders(new SupabaseFolderRepository(session.client)),
      preferences: new AccountPreferencesService(
        new SupabasePreferencesRepository(session.client),
      ),
      tenantId: session.account.tenantId,
    }
  }

  const authenticateStatusPage = async (context: Context) => {
    const session = await resolveSession(context)

    if (!session) {
      return null
    }

    return {
      settings: new ManageStatusPage(
        new SupabaseStatusPageSettings(session.client),
      ),
      tenantId: session.account.tenantId,
    }
  }

  const authenticateMaintenance = async (context: Context) => {
    const session = await resolveSession(context)

    if (!session) {
      return null
    }

    return {
      maintenance: new ManageMaintenance(
        new SupabaseMaintenance(session.client),
      ),
      tenantId: session.account.tenantId,
    }
  }

  const apiKeyGenerator = new CryptoApiKeyGenerator(
    environment.PING_TOKEN_PEPPER,
  )
  const authenticateApiKeys = async (context: Context) => {
    const session = await resolveSession(context)

    if (!session) {
      return null
    }

    return {
      keys: new ManageApiKeys({
        generator: apiKeyGenerator,
        store: new SupabaseApiKeyStore(session.client),
      }),
      tenantId: session.account.tenantId,
    }
  }

  const authenticateChannels = async (context: Context) => {
    const session = await resolveSession(context)

    if (!session) {
      return null
    }

    return {
      channels: new ManageChannels({
        appOrigin: environment.APP_ORIGIN,
        channels: new SupabaseChannelRepository(session.client),
        secrets: new SupabaseChannelSecrets(
          createServiceSupabaseClient(environment),
        ),
        sender: new HttpChannelSender(),
      }),
      tenantId: session.account.tenantId,
    }
  }

  const authenticateLive = async (context: Context) => {
    const session = await resolveSession(context)

    return session ? { tenantId: session.account.tenantId } : null
  }

  const connectLive = async (tenantId: string, request: Request) => {
    const namespace = environment.TENANT_LIVE_HUB

    if (!namespace) {
      return Response.json(
        {
          error: {
            code: 'live_unavailable',
            message: 'Live updates are not configured',
          },
        },
        { status: 503 },
      )
    }

    const headers = new Headers(request.headers)

    // The hub trusts this header: only the Worker can reach it, and it is
    // always overwritten with the tenant of the authenticated session.
    headers.set('x-tenant-id', tenantId)

    return namespace
      .get(namespace.idFromName(tenantId))
      .fetch(new Request(request.url, { headers, method: 'GET' }))
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
    canWrite,
    teamRoutes: createTeamRoutes({ authenticate: authenticateTeam }),
    accountRoutes: createAccountRoutes({
      authenticate: authenticateAccount,
    }),
    allowedOrigin: environment.APP_ORIGIN,
    ...(environment.CLIENT_IP_HEADER
      ? { clientIpHeader: environment.CLIENT_IP_HEADER }
      : {}),
    authRoutes: createAuthRoutes({
      accounts,
      codec,
      signupsEnabled: !['false', '0'].includes(
        environment.SIGNUPS_ENABLED?.toLowerCase() ?? '',
      ),
    }),
    monitorRoutes: createMonitorRoutes({ authenticate: authenticateMonitor }),
    notificationRoutes: createNotificationRoutes({
      authenticate: authenticateNotifications,
    }),
    pingRoutes: createPingRoutes({
      execute: (token) => recordHeartbeat.execute(token),
      recordEvent: (token, kind) => recordRunEvent.execute(token, kind),
    }),
    channelRoutes: createChannelRoutes({
      authenticate: authenticateChannels,
    }),
    liveRoutes: createLiveRoutes({
      allowedOrigin: environment.APP_ORIGIN,
      authenticate: authenticateLive,
      connect: connectLive,
    }),
    apiKeyRoutes: createApiKeyRoutes({
      authenticate: authenticateApiKeys,
      authenticator: new AuthenticateApiKey({
        authenticator: new SupabaseApiKeyAuthenticator(
          createServiceSupabaseClient(environment),
        ),
        generator: apiKeyGenerator,
      }),
      // Service client + explicit tenant filter in the repository: the key
      // grants read access to its own tenant only.
      monitors: new MonitorReadService(
        new SupabaseMonitorQueryRepository(
          createServiceSupabaseClient(
            environment,
          ) as unknown as MonitorQueryClient,
        ),
      ),
    }),
    maintenanceRoutes: createMaintenanceRoutes({
      authenticate: authenticateMaintenance,
    }),
    statusPageRoutes: createStatusPageRoutes({
      authenticate: authenticateStatusPage,
      publicPage: new ReadPublicStatusPage(
        new SupabasePublicStatusPage(supabase),
      ),
    }),
    workspaceRoutes: createWorkspaceRoutes({
      authenticate: authenticateWorkspace,
    }),
    ...(environment.AUTH_RATE_LIMITER && environment.PING_RATE_LIMITER
      ? {
          rateLimiters: {
            auth: createCloudflareRateLimiter(environment.AUTH_RATE_LIMITER),
            ping: createCloudflareRateLimiter(environment.PING_RATE_LIMITER),
          },
        }
      : {}),
  })
}

export async function runCronDeadlineRefinement(
  environment: WorkerEnvironment,
) {
  return new RefineCronDeadlines({
    nowMs: () => Date.now(),
    port: new SupabaseCronDeadlines(createServiceSupabaseClient(environment)),
  }).execute()
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

/** E-mail goes through Resend when configured, else through SMTP. */
function createNotificationSender(environment: WorkerEnvironment) {
  if (environment.RESEND_API_KEY && environment.RESEND_FROM_EMAIL) {
    return new ResendNotificationSender({
      apiKey: environment.RESEND_API_KEY,
      appOrigin: environment.APP_ORIGIN,
      from: environment.RESEND_FROM_EMAIL,
    })
  }

  if (environment.EMAIL_TRANSPORT && environment.EMAIL_FROM) {
    return new SmtpNotificationSender({
      appOrigin: environment.APP_ORIGIN,
      from: environment.EMAIL_FROM,
      transport: environment.EMAIL_TRANSPORT,
    })
  }

  return null
}

function createWeeklyReportSender(environment: WorkerEnvironment) {
  if (environment.RESEND_API_KEY && environment.RESEND_FROM_EMAIL) {
    return new ResendWeeklyReportSender({
      apiKey: environment.RESEND_API_KEY,
      appOrigin: environment.APP_ORIGIN,
      from: environment.RESEND_FROM_EMAIL,
    })
  }

  if (environment.EMAIL_TRANSPORT && environment.EMAIL_FROM) {
    return new SmtpWeeklyReportSender({
      appOrigin: environment.APP_ORIGIN,
      from: environment.EMAIL_FROM,
      transport: environment.EMAIL_TRANSPORT,
    })
  }

  return null
}

export async function runNotificationDelivery(
  environment: WorkerEnvironment,
  batchSize = 10,
) {
  const sender = createNotificationSender(environment)

  if (!sender) {
    return null
  }

  const client = createServiceSupabaseClient(environment)
  const deliver = new DeliverNotifications({
    queue: new SupabaseNotificationDeliveryQueue(
      client as unknown as NotificationDeliveryRpcClient,
    ),
    sender,
  })

  return deliver.execute(batchSize)
}

export async function runWeeklyReports(environment: WorkerEnvironment) {
  const sender = createWeeklyReportSender(environment)

  if (!sender) {
    return null
  }

  return new SendWeeklyReports({
    queue: new SupabaseWeeklyReportQueue(
      createServiceSupabaseClient(environment),
    ),
    sender,
  }).execute(Date.now())
}

export async function runIncidentReminders(
  environment: WorkerEnvironment,
): Promise<number> {
  return new EnqueueIncidentReminders(
    new SupabaseIncidentReminders(createServiceSupabaseClient(environment)),
  ).execute()
}

export async function runChannelDelivery(environment: WorkerEnvironment) {
  return new DeliverChannelAlerts({
    appOrigin: environment.APP_ORIGIN,
    queue: new SupabaseChannelDeliveryQueue(
      createServiceSupabaseClient(environment),
    ),
    sender: new HttpChannelSender(),
  }).execute()
}

/**
 * One scheduled pass: detect late monitors, enqueue reminders, then deliver
 * e-mails, channel alerts and the weekly report. Shared by the Cloudflare cron
 * trigger and the self-hosted scheduler.
 */
export async function runScheduledTick(environment: WorkerEnvironment) {
  // Exact cron deadlines first, so the check below never uses a provisional one.
  const cron = await runCronDeadlineRefinement(environment)
  const opened = await runScheduledCheck(environment)
  const reminders = await runIncidentReminders(environment)
  const delivery = await runNotificationDelivery(environment)
  const channels = await runChannelDelivery(environment)
  const weekly = await runWeeklyReports(environment)

  console.info(
    JSON.stringify({
      channels,
      cron,
      delivery,
      event: 'cron.tick',
      opened,
      reminders,
      weekly,
    }),
  )
}
