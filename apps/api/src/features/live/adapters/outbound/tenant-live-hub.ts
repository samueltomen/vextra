import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  LIVE_POLL_INTERVAL_MS,
  LiveHub,
  type LiveSocket,
  type TenantSignaturePort,
} from '../../application/live-hub.ts'

export type LiveHubEnvironment = Readonly<{
  SUPABASE_SERVICE_ROLE_KEY: string
  SUPABASE_URL: string
}>

type MonitorSignatureRow = Readonly<{
  alert_at: string
  folder_id: string | null
  id: string
  last_heartbeat_at: string | null
  paused_at: string | null
  status: string
  total_pings: number | string
  updated_at: string
}>

type OutboxSignatureRow = Readonly<{
  attempts: number
  id: string
  status: string
}>

/** Fingerprint of monitors and recent notifications of a single tenant. */
export class SupabaseTenantSignature implements TenantSignaturePort {
  constructor(private readonly client: SupabaseClient) {}

  async read(tenantId: string): Promise<string> {
    const [monitors, outbox] = await Promise.all([
      this.client
        .from('monitors')
        .select(
          'id, status, last_heartbeat_at, alert_at, paused_at, folder_id, total_pings, updated_at',
        )
        .eq('tenant_id', tenantId),
      this.client
        .from('notification_outbox')
        .select('id, status, attempts')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (monitors.error || outbox.error) {
      throw new Error('live signature query failed')
    }

    const monitorPart = (
      (monitors.data ?? []) as readonly MonitorSignatureRow[]
    )
      .map((row) =>
        [
          row.id,
          row.status,
          row.last_heartbeat_at,
          row.alert_at,
          row.paused_at,
          row.folder_id,
          row.total_pings,
          row.updated_at,
        ].join('|'),
      )
      .sort()
      .join(';')
    const outboxPart = ((outbox.data ?? []) as readonly OutboxSignatureRow[])
      .map((row) => `${row.id}|${row.status}|${row.attempts}`)
      .join(';')

    return `${monitorPart}#${outboxPart}`
  }
}

type RuntimeWebSocket = LiveSocket & { close: (code?: number) => void }

type DurableObjectStateLike = Readonly<{
  acceptWebSocket: (socket: RuntimeWebSocket) => void
  getWebSockets: () => RuntimeWebSocket[]
  storage: Readonly<{
    get: <T>(key: string) => Promise<T | undefined>
    put: (key: string, value: unknown) => Promise<void>
    setAlarm: (scheduledTimeMs: number) => Promise<void>
  }>
}>

declare const WebSocketPair: new () => Record<0 | 1, RuntimeWebSocket>

/**
 * One instance per tenant. Uses the WebSocket Hibernation API: the object is
 * only awake while it polls, and polling stops with the last connection.
 */
export class TenantLiveHub {
  private readonly hub: LiveHub

  constructor(
    private readonly state: DurableObjectStateLike,
    environment: LiveHubEnvironment,
  ) {
    const client = createClient(
      environment.SUPABASE_URL,
      environment.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
        db: { timeout: 8_000 },
      },
    )

    this.hub = new LiveHub(new SupabaseTenantSignature(client))
  }

  async fetch(request: Request): Promise<Response> {
    const tenantId = request.headers.get('x-tenant-id')

    if (!tenantId || request.headers.get('upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    this.state.acceptWebSocket(server)
    await this.state.storage.put('tenantId', tenantId)
    this.hub.onConnect(server)
    await this.state.storage.setAlarm(Date.now() + LIVE_POLL_INTERVAL_MS)

    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit)
  }

  async alarm(): Promise<void> {
    const tenantId = await this.state.storage.get<string>('tenantId')

    if (!tenantId) {
      return
    }

    const keepPolling = await this.hub.tick(
      tenantId,
      this.state.getWebSockets(),
    )

    if (keepPolling) {
      await this.state.storage.setAlarm(Date.now() + LIVE_POLL_INTERVAL_MS)
    }
  }

  webSocketMessage(socket: RuntimeWebSocket, message: string | ArrayBuffer) {
    this.hub.onMessage(socket, typeof message === 'string' ? message : '')
  }

  webSocketClose(socket: RuntimeWebSocket, code: number) {
    socket.close(code === 1005 ? 1000 : code)
  }
}
