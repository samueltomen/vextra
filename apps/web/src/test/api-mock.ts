import { vi } from 'vitest'

export const TEST_ACCOUNT = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  user: {
    email: 'alice@example.test',
    id: '00000000-0000-4000-8000-000000000001',
  },
} as const

type MonitorRow = {
  alertAt: string
  alertsEnabled: boolean
  createdAt: string
  cronExpression: string | null
  cronTimezone: string | null
  description: string | null
  folderId: string | null
  graceSeconds: number
  id: string
  incidentOpenedAt: string | null
  intervalSeconds: number
  lastHeartbeatAt: string | null
  name: string | null
  notes: string | null
  pausedAt: string | null
  runningSince: string | null
  status: 'healthy' | 'late' | 'paused' | 'pending'
  tags: string[]
  totalPings: number
}

export const TEST_FOLDER_ID = '30000000-0000-4000-8000-000000000001'

export const TEST_MONITOR_LABELS = {
  '20000000-0000-4000-8000-000000000001': 'Sauvegarde PostgreSQL',
  '20000000-0000-4000-8000-000000000002': 'Synchronisation Stripe',
  '20000000-0000-4000-8000-000000000003': 'Rapport hebdomadaire',
  '20000000-0000-4000-8000-000000000004': 'Nettoyage des médias',
} as const

function createMonitorRows(nowMs = Date.now()): MonitorRow[] {
  return [
    {
      alertAt: new Date(nowMs + 60 * 60_000).toISOString(),
      alertsEnabled: true,
      description: null,
      createdAt: new Date(nowMs - 86_400_000).toISOString(),
      cronExpression: null,
      cronTimezone: null,
      folderId: null,
      graceSeconds: 1_800,
      id: '20000000-0000-4000-8000-000000000001',
      incidentOpenedAt: null,
      intervalSeconds: 86_400,
      lastHeartbeatAt: new Date(nowMs - 42 * 60_000).toISOString(),
      name: null,
      notes: null,
      pausedAt: null,
      runningSince: null,
      status: 'healthy',
      tags: [],
      totalPings: 0,
    },
    {
      alertAt: new Date(nowMs - 6 * 60_000).toISOString(),
      alertsEnabled: true,
      description: null,
      createdAt: new Date(nowMs - 86_400_000).toISOString(),
      cronExpression: null,
      cronTimezone: null,
      folderId: null,
      graceSeconds: 180,
      id: '20000000-0000-4000-8000-000000000002',
      incidentOpenedAt: new Date(nowMs - 6 * 60_000).toISOString(),
      intervalSeconds: 900,
      lastHeartbeatAt: new Date(nowMs - 24 * 60_000).toISOString(),
      name: null,
      notes: null,
      pausedAt: null,
      runningSince: null,
      status: 'late',
      tags: [],
      totalPings: 0,
    },
    {
      alertAt: new Date(nowMs + 4 * 86_400_000).toISOString(),
      alertsEnabled: true,
      description: null,
      createdAt: new Date(nowMs - 7 * 86_400_000).toISOString(),
      cronExpression: null,
      cronTimezone: null,
      folderId: null,
      graceSeconds: 7_200,
      id: '20000000-0000-4000-8000-000000000003',
      incidentOpenedAt: null,
      intervalSeconds: 604_800,
      lastHeartbeatAt: new Date(nowMs - 4 * 86_400_000).toISOString(),
      name: null,
      notes: null,
      pausedAt: new Date(nowMs - 86_400_000).toISOString(),
      runningSince: null,
      status: 'paused',
      tags: [],
      totalPings: 0,
    },
    {
      alertAt: new Date(nowMs + 6 * 60 * 60_000).toISOString(),
      alertsEnabled: true,
      description: null,
      createdAt: new Date(nowMs - 60_000).toISOString(),
      cronExpression: null,
      cronTimezone: null,
      folderId: null,
      graceSeconds: 1_200,
      id: '20000000-0000-4000-8000-000000000004',
      incidentOpenedAt: null,
      intervalSeconds: 21_600,
      lastHeartbeatAt: null,
      name: null,
      notes: null,
      pausedAt: null,
      runningSince: null,
      status: 'pending',
      tags: [],
      totalPings: 0,
    },
  ]
}

const DEFAULT_METRICS = {
  days: [
    {
      day: new Date().toISOString().slice(0, 10),
      durationCount: 2,
      durationMaxMs: 3_000,
      durationSumMs: 4_000,
      fails: 1,
      gapCount: 2,
      gapMaxSeconds: 3_700,
      gapSumSeconds: 7_200,
      pings: 3,
    },
  ],
  totalPings: 42,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse({ error: { code, message: 'Request failed' } }, status)
}

export type ApiMockOptions = Readonly<{
  authenticated?: boolean
  loginStatus?: number
  folders?: { id: string; name: string }[]
  metrics?: unknown
  monitors?: MonitorRow[]
}>

export function installApiMock(options: ApiMockOptions = {}) {
  let authenticated = options.authenticated ?? true
  const apiKeys: {
    createdAt: string
    id: string
    lastUsedAt: string | null
    name: string
    prefix: string
    revokedAt: string | null
  }[] = []
  let maintenanceWindows: {
    endsAt: string
    id: string
    monitorId: string | null
    name: string
    startsAt: string
  }[] = []
  let statusPage: {
    monitorIds: string[]
    page: Record<string, unknown> | null
  } = { monitorIds: [], page: null }
  const channels: {
    createdAt: string
    enabled: boolean
    id: string
    kind: string
    name: string
    targetHint: string
  }[] = []
  const folders = [
    ...(options.folders ?? [{ id: TEST_FOLDER_ID, name: 'Production' }]),
  ]
  let preferences = {
    dashboardSort: 'priority',
    dashboardView: 'list',
    defaultFolderId: null as string | null,
    defaultGraceMinutes: 2,
    defaultIntervalMinutes: 5,
    density: 'compact',
    displayName: null as string | null,
    notifyOnOpen: true,
    notifyOnResolve: true,
    reminderIntervalMinutes: null as number | null,
    timeFormat: '24h',
    timezone: 'Europe/Paris',
    weeklyReportEnabled: true,
  }
  const monitors = [...(options.monitors ?? createMonitorRows())]
  const incidents = monitors
    .filter((monitor) => monitor.status === 'late')
    .map((monitor) => ({
      id: `incident-${monitor.id}`,
      monitorId: monitor.id,
      openedAt: monitor.incidentOpenedAt ?? new Date().toISOString(),
      reason: 'heartbeat_missed' as const,
      resolutionReason: null,
      resolvedAt: null,
    }))
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), window.location.origin)
      const method = init?.method ?? 'GET'

      if (url.pathname.endsWith('/details') && method === 'PATCH') {
        const monitorId = url.pathname.split('/').at(-2)
        const changes = JSON.parse(
          String(init?.body),
        ) as Partial<MonitorRow> & {
          alertsEnabled?: boolean
        }
        const monitor = monitors.find((candidate) => candidate.id === monitorId)

        if (monitor) {
          Object.assign(monitor, changes)
        }

        return new Response(null, { status: monitor ? 204 : 404 })
      }

      if (url.pathname === '/api/monitors/activity' && method === 'GET') {
        return jsonResponse({
          data: {
            monitors: [
              {
                days: [
                  { day: new Date().toISOString().slice(0, 10), pings: 3 },
                ],
                monitorId: '20000000-0000-4000-8000-000000000001',
              },
            ],
          },
        })
      }

      if (url.pathname === '/api/channels' && method === 'GET') {
        return jsonResponse({ data: { channels } })
      }

      if (url.pathname === '/api/channels' && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as {
          kind: string
          name: string
          target: string
        }

        if (!body.target.startsWith('https://')) {
          return errorResponse(422, 'invalid_channel_target')
        }

        if (channels.some((channel) => channel.name === body.name)) {
          return errorResponse(409, 'channel_name_taken')
        }

        const channel = {
          createdAt: new Date().toISOString(),
          enabled: true,
          id: crypto.randomUUID(),
          kind: body.kind,
          name: body.name,
          targetHint: 'example.com/…hook',
        }

        channels.push(channel)

        return jsonResponse({ data: { channel } }, 201)
      }

      if (url.pathname.startsWith('/api/channels/')) {
        const parts = url.pathname.split('/')
        const channel = channels.find((candidate) => candidate.id === parts[3])

        if (!channel) {
          return errorResponse(404, 'channel_not_found')
        }

        if (method === 'POST' && parts[4] === 'test') {
          return channel.name === 'Cassé'
            ? errorResponse(502, 'channel_test_failed')
            : new Response(null, { status: 204 })
        }

        if (method === 'PATCH') {
          channel.enabled = (
            JSON.parse(String(init?.body)) as { enabled: boolean }
          ).enabled

          return new Response(null, { status: 204 })
        }

        if (method === 'DELETE') {
          channels.splice(channels.indexOf(channel), 1)

          return new Response(null, { status: 204 })
        }
      }

      if (url.pathname === '/api/api-keys' && method === 'GET') {
        return jsonResponse({ data: { keys: apiKeys } })
      }

      if (url.pathname === '/api/api-keys' && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as { name: string }

        if (body.name === 'limite') {
          return errorResponse(409, 'limit_reached')
        }

        const apiKey = {
          createdAt: new Date().toISOString(),
          id: crypto.randomUUID(),
          lastUsedAt: null,
          name: body.name,
          prefix: 'vx_test-sec',
          revokedAt: null as string | null,
        }

        apiKeys.unshift(apiKey)

        return jsonResponse(
          { data: { apiKey, key: `vx_test-secret-${'x'.repeat(30)}` } },
          201,
        )
      }

      if (url.pathname.startsWith('/api/api-keys/') && method === 'DELETE') {
        const key = apiKeys.find(
          (candidate) => candidate.id === url.pathname.split('/').at(-1),
        )

        if (key) {
          key.revokedAt = new Date().toISOString()
        }

        return new Response(null, { status: 204 })
      }

      if (url.pathname === '/api/maintenance' && method === 'GET') {
        return jsonResponse({ data: { windows: maintenanceWindows } })
      }

      if (url.pathname === '/api/maintenance' && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as {
          endsAt: string
          monitorId: string | null
          name: string
          startsAt: string
        }

        if (body.name === 'limite') {
          return errorResponse(409, 'limit_reached')
        }

        const created = { ...body, id: crypto.randomUUID() }

        maintenanceWindows.push(created)

        return jsonResponse({ data: created }, 201)
      }

      if (url.pathname.startsWith('/api/maintenance/') && method === 'DELETE') {
        const id = url.pathname.split('/').at(-1)

        maintenanceWindows = maintenanceWindows.filter(
          (window) => window.id !== id,
        )

        return new Response(null, { status: 204 })
      }

      if (url.pathname === '/api/status-page' && method === 'GET') {
        return jsonResponse({ data: statusPage })
      }

      if (url.pathname === '/api/status-page' && method === 'PUT') {
        const body = JSON.parse(String(init?.body)) as {
          monitorIds: string[]
          slug: string
          title: string
        }

        if (body.slug === 'pris') {
          return errorResponse(409, 'slug_taken')
        }

        statusPage = {
          monitorIds: body.monitorIds,
          page: { description: null, enabled: true, ...body },
        }

        return jsonResponse({ data: statusPage })
      }

      if (url.pathname.startsWith('/api/status/') && method === 'GET') {
        return url.pathname.endsWith('/acme-status')
          ? jsonResponse({
              data: {
                description: null,
                generatedAt: new Date().toISOString(),
                incidents: [
                  {
                    monitor: 'API publique',
                    openedAt: new Date(Date.now() - 86_400_000).toISOString(),
                    resolvedAt: null,
                  },
                ],
                monitors: [
                  { name: 'API publique', status: 'late', uptime30d: 99.5 },
                ],
                title: 'Acme',
              },
            })
          : errorResponse(404, 'not_found')
      }

      if (url.pathname === '/api/folders' && method === 'GET') {
        return jsonResponse({ data: { folders } })
      }

      if (url.pathname === '/api/folders' && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as { name: string }

        if (folders.some((folder) => folder.name === body.name)) {
          return errorResponse(409, 'folder_name_taken')
        }

        const folder = { id: crypto.randomUUID(), name: body.name }

        folders.push(folder)

        return jsonResponse({ data: { folder } }, 201)
      }

      if (url.pathname.startsWith('/api/folders/') && method === 'PATCH') {
        const id = url.pathname.split('/').at(-1)
        const body = JSON.parse(String(init?.body)) as { name: string }
        const folder = folders.find((candidate) => candidate.id === id)

        if (folder) {
          folder.name = body.name
        }

        return folder
          ? jsonResponse({ data: { folder } })
          : errorResponse(404, 'folder_not_found')
      }

      if (url.pathname.startsWith('/api/folders/') && method === 'DELETE') {
        const id = url.pathname.split('/').at(-1)
        const index = folders.findIndex((candidate) => candidate.id === id)

        if (index >= 0) {
          folders.splice(index, 1)
          monitors.forEach((monitor) => {
            if (monitor.folderId === id) {
              monitor.folderId = null
            }
          })
        }

        return new Response(null, { status: index >= 0 ? 204 : 404 })
      }

      if (url.pathname.endsWith('/folder') && method === 'PUT') {
        const monitorId = url.pathname.split('/').at(-2)
        const body = JSON.parse(String(init?.body)) as {
          folderId: string | null
        }
        const monitor = monitors.find((candidate) => candidate.id === monitorId)

        if (monitor) {
          monitor.folderId = body.folderId
        }

        return new Response(null, { status: monitor ? 204 : 404 })
      }

      if (url.pathname === '/api/preferences' && method === 'GET') {
        return jsonResponse({ data: { preferences } })
      }

      if (url.pathname === '/api/preferences' && method === 'PATCH') {
        preferences = {
          ...preferences,
          ...(JSON.parse(String(init?.body)) as object),
        }

        return jsonResponse({ data: { preferences } })
      }

      if (url.pathname.endsWith('/runs') && method === 'GET') {
        return jsonResponse({
          data: {
            runs: [
              {
                createdAt: new Date().toISOString(),
                durationMs: 2_000,
                id: '40000000-0000-4000-8000-000000000001',
                kind: 'success',
                overlapped: false,
              },
              {
                createdAt: new Date().toISOString(),
                durationMs: null,
                id: '40000000-0000-4000-8000-000000000002',
                kind: 'start',
                overlapped: true,
              },
            ],
          },
        })
      }

      if (url.pathname.endsWith('/metrics') && method === 'GET') {
        return jsonResponse({ data: options.metrics ?? DEFAULT_METRICS })
      }

      if (url.pathname === '/api/auth/me' && method === 'GET') {
        return authenticated
          ? jsonResponse({ data: TEST_ACCOUNT })
          : errorResponse(401, 'unauthorized')
      }

      if (url.pathname === '/api/auth/login' && method === 'POST') {
        if (options.loginStatus && options.loginStatus >= 400) {
          return errorResponse(options.loginStatus, 'invalid_credentials')
        }

        authenticated = true
        return jsonResponse({ data: TEST_ACCOUNT })
      }

      if (url.pathname === '/api/auth/signup' && method === 'POST') {
        authenticated = true
        return jsonResponse(
          {
            data: {
              requiresEmailConfirmation: false,
              user: TEST_ACCOUNT.user,
            },
          },
          201,
        )
      }

      if (url.pathname === '/api/auth/logout' && method === 'POST') {
        authenticated = false
        return new Response(null, { status: 204 })
      }

      if (url.pathname === '/api/account' && method === 'DELETE') {
        authenticated = false
        return new Response(null, { status: 204 })
      }

      if (url.pathname === '/api/notifications' && method === 'GET') {
        return authenticated
          ? jsonResponse({
              data: {
                deliveries: [
                  {
                    attempts: 1,
                    createdAt: new Date(Date.now() - 600_000).toISOString(),
                    id: 'a0000000-0000-4000-8000-000000000001',
                    kind: 'incident_opened',
                    monitorId: '20000000-0000-4000-8000-000000000002',
                    status: 'sent',
                    updatedAt: new Date(Date.now() - 540_000).toISOString(),
                  },
                  {
                    attempts: 2,
                    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
                    kind: 'incident_resolved',
                    monitorId: '20000000-0000-4000-8000-000000000001',
                    status: 'failed',
                    updatedAt: new Date(Date.now() - 3_000_000).toISOString(),
                  },
                ],
              },
            })
          : errorResponse(401, 'unauthorized')
      }

      if (url.pathname === '/api/monitors' && method === 'GET') {
        return authenticated
          ? jsonResponse({ data: { monitors } })
          : errorResponse(401, 'unauthorized')
      }

      if (url.pathname === '/api/monitors' && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as {
          cron?: string
          graceSeconds: number
          intervalSeconds?: number
          timezone?: string
        }
        const intervalSeconds = body.intervalSeconds ?? 86_400
        const nowMs = Date.now()
        const monitor: MonitorRow = {
          alertAt: new Date(
            nowMs + (intervalSeconds + body.graceSeconds) * 1_000,
          ).toISOString(),
          alertsEnabled: true,
          createdAt: new Date(nowMs).toISOString(),
          cronExpression: body.cron ?? null,
          cronTimezone: body.cron ? (body.timezone ?? 'UTC') : null,
          description: null,
          folderId: null,
          graceSeconds: body.graceSeconds,
          id: '20000000-0000-4000-8000-000000000099',
          incidentOpenedAt: null,
          intervalSeconds,
          lastHeartbeatAt: null,
          name: null,
          notes: null,
          pausedAt: null,
          runningSince: null,
          status: 'pending',
          tags: [],
          totalPings: 0,
        }

        monitors.unshift(monitor)

        return jsonResponse(
          {
            data: {
              alertAt: monitor.alertAt,
              graceSeconds: monitor.graceSeconds,
              heartbeatToken: 'cp_test-heartbeat-token',
              id: monitor.id,
              intervalSeconds: monitor.intervalSeconds,
              status: monitor.status,
            },
          },
          201,
        )
      }

      if (url.pathname.startsWith('/api/monitors/') && method === 'PATCH') {
        const monitorId = decodeURIComponent(
          url.pathname.split('/').at(-1) ?? '',
        )
        const monitor = monitors.find((candidate) => candidate.id === monitorId)

        if (!monitor) {
          return errorResponse(404, 'monitor_not_found')
        }

        const body = JSON.parse(String(init?.body)) as {
          cron?: string
          graceSeconds: number
          intervalSeconds?: number
          timezone?: string
        }
        const intervalSeconds = body.intervalSeconds ?? 86_400

        monitor.graceSeconds = body.graceSeconds
        monitor.intervalSeconds = intervalSeconds
        monitor.cronExpression = body.cron ?? null
        monitor.cronTimezone = body.cron ? (body.timezone ?? 'UTC') : null

        if (monitor.status !== 'paused' && monitor.status !== 'late') {
          monitor.alertAt = new Date(
            Date.now() + (intervalSeconds + body.graceSeconds) * 1_000,
          ).toISOString()
        }

        return jsonResponse({ data: { monitor } })
      }

      if (url.pathname.startsWith('/api/monitors/') && method === 'DELETE') {
        const monitorId = decodeURIComponent(
          url.pathname.split('/').at(-1) ?? '',
        )
        const index = monitors.findIndex((monitor) => monitor.id === monitorId)

        if (index >= 0) {
          monitors.splice(index, 1)
        }

        return new Response(null, { status: 204 })
      }

      if (url.pathname.endsWith('/pause') || url.pathname.endsWith('/resume')) {
        const monitorId = decodeURIComponent(
          url.pathname.split('/').at(-2) ?? '',
        )
        const monitor = monitors.find((candidate) => candidate.id === monitorId)

        if (!monitor) {
          return errorResponse(404, 'monitor_not_found')
        }

        monitor.status = url.pathname.endsWith('/pause') ? 'paused' : 'pending'
        monitor.pausedAt = url.pathname.endsWith('/pause')
          ? new Date().toISOString()
          : null

        return new Response(null, { status: 204 })
      }

      if (url.pathname.endsWith('/rotate-token') && method === 'POST') {
        const monitorId = decodeURIComponent(
          url.pathname.split('/').at(-2) ?? '',
        )
        const monitor = monitors.find((candidate) => candidate.id === monitorId)

        return monitor
          ? jsonResponse({
              data: { heartbeatToken: 'cp_rotated-heartbeat-token' },
            })
          : errorResponse(404, 'monitor_not_found')
      }

      if (url.pathname.endsWith('/incidents') && method === 'GET') {
        const monitorId = decodeURIComponent(
          url.pathname.split('/').at(-2) ?? '',
        )

        return jsonResponse({
          data: {
            incidents: incidents.filter(
              (incident) => incident.monitorId === monitorId,
            ),
          },
        })
      }

      if (url.pathname.startsWith('/api/monitors/') && method === 'GET') {
        const monitorId = decodeURIComponent(
          url.pathname.split('/').at(-1) ?? '',
        )
        const monitor = monitors.find((candidate) => candidate.id === monitorId)

        return monitor
          ? jsonResponse({ data: { monitor } })
          : errorResponse(404, 'monitor_not_found')
      }

      return errorResponse(404, 'not_found')
    },
  )

  vi.stubGlobal('fetch', fetchMock)

  return { fetchMock, monitors, preferences: () => preferences }
}
