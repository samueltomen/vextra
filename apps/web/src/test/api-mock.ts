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
  createdAt: string
  graceSeconds: number
  id: string
  incidentOpenedAt: string | null
  intervalSeconds: number
  lastHeartbeatAt: string | null
  pausedAt: string | null
  status: 'healthy' | 'late' | 'paused' | 'pending'
}

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
      createdAt: new Date(nowMs - 86_400_000).toISOString(),
      graceSeconds: 1_800,
      id: '20000000-0000-4000-8000-000000000001',
      incidentOpenedAt: null,
      intervalSeconds: 86_400,
      lastHeartbeatAt: new Date(nowMs - 42 * 60_000).toISOString(),
      pausedAt: null,
      status: 'healthy',
    },
    {
      alertAt: new Date(nowMs - 6 * 60_000).toISOString(),
      createdAt: new Date(nowMs - 86_400_000).toISOString(),
      graceSeconds: 180,
      id: '20000000-0000-4000-8000-000000000002',
      incidentOpenedAt: new Date(nowMs - 6 * 60_000).toISOString(),
      intervalSeconds: 900,
      lastHeartbeatAt: new Date(nowMs - 24 * 60_000).toISOString(),
      pausedAt: null,
      status: 'late',
    },
    {
      alertAt: new Date(nowMs + 4 * 86_400_000).toISOString(),
      createdAt: new Date(nowMs - 7 * 86_400_000).toISOString(),
      graceSeconds: 7_200,
      id: '20000000-0000-4000-8000-000000000003',
      incidentOpenedAt: null,
      intervalSeconds: 604_800,
      lastHeartbeatAt: new Date(nowMs - 4 * 86_400_000).toISOString(),
      pausedAt: new Date(nowMs - 86_400_000).toISOString(),
      status: 'paused',
    },
    {
      alertAt: new Date(nowMs + 6 * 60 * 60_000).toISOString(),
      createdAt: new Date(nowMs - 60_000).toISOString(),
      graceSeconds: 1_200,
      id: '20000000-0000-4000-8000-000000000004',
      incidentOpenedAt: null,
      intervalSeconds: 21_600,
      lastHeartbeatAt: null,
      pausedAt: null,
      status: 'pending',
    },
  ]
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
  monitors?: MonitorRow[]
}>

export function installApiMock(options: ApiMockOptions = {}) {
  let authenticated = options.authenticated ?? true
  const monitors = [...(options.monitors ?? createMonitorRows())]
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), window.location.origin)
      const method = init?.method ?? 'GET'

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

      if (url.pathname === '/api/monitors' && method === 'GET') {
        return authenticated
          ? jsonResponse({ data: { monitors } })
          : errorResponse(401, 'unauthorized')
      }

      if (url.pathname === '/api/monitors' && method === 'POST') {
        const body = JSON.parse(String(init?.body)) as {
          graceSeconds: number
          intervalSeconds: number
        }
        const nowMs = Date.now()
        const monitor: MonitorRow = {
          alertAt: new Date(
            nowMs + (body.intervalSeconds + body.graceSeconds) * 1_000,
          ).toISOString(),
          createdAt: new Date(nowMs).toISOString(),
          graceSeconds: body.graceSeconds,
          id: '20000000-0000-4000-8000-000000000099',
          incidentOpenedAt: null,
          intervalSeconds: body.intervalSeconds,
          lastHeartbeatAt: null,
          pausedAt: null,
          status: 'pending',
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

  return { fetchMock }
}
