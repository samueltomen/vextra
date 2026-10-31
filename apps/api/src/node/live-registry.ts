import {
  LIVE_POLL_INTERVAL_MS,
  LiveHub,
  type LiveSocket,
  type TenantSignaturePort,
} from '../features/live/application/live-hub.ts'
import type { TenantLiveHubNamespace } from '../composition.ts'

export type RegistrySocket = LiveSocket &
  Readonly<{
    onClose: (listener: () => void) => void
    onMessage: (listener: (message: string) => void) => void
  }>

export type Scheduler = Readonly<{
  clear: (handle: unknown) => void
  every: (intervalMs: number, task: () => void) => unknown
}>

const DEFAULT_SCHEDULER: Scheduler = {
  clear: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  every: (intervalMs, task) => setInterval(task, intervalMs),
}

type TenantEntry = {
  hub: LiveHub
  sockets: Set<RegistrySocket>
  ticking: boolean
  timer: unknown
}

/**
 * In-process counterpart of the Cloudflare Durable Object: tracks the live
 * connections of each tenant and polls a cheap fingerprint of its data while
 * somebody is connected.
 */
export class LiveRegistry {
  private readonly tenants = new Map<string, TenantEntry>()
  private readonly scheduler: Scheduler
  private readonly intervalMs: number

  /** Stand-in for the Durable Object namespace: it only echoes the tenant. */
  readonly namespace: TenantLiveHubNamespace = {
    get: () => ({
      fetch: async (request: Request) =>
        new Response(request.headers.get('x-tenant-id') ?? '', { status: 200 }),
    }),
    idFromName: (name) => name,
  }

  constructor(
    private readonly dependencies: Readonly<{
      intervalMs?: number
      port: TenantSignaturePort
      scheduler?: Scheduler
    }>,
  ) {
    this.scheduler = dependencies.scheduler ?? DEFAULT_SCHEDULER
    this.intervalMs = dependencies.intervalMs ?? LIVE_POLL_INTERVAL_MS
  }

  get tenantCount(): number {
    return this.tenants.size
  }

  add(tenantId: string, socket: RegistrySocket): void {
    let entry = this.tenants.get(tenantId)

    if (!entry) {
      entry = {
        hub: new LiveHub(this.dependencies.port),
        sockets: new Set(),
        ticking: false,
        timer: undefined,
      }
      this.tenants.set(tenantId, entry)
    }

    const current = entry

    current.sockets.add(socket)
    current.hub.onConnect(socket)
    socket.onMessage((message) => current.hub.onMessage(socket, message))
    socket.onClose(() => this.remove(tenantId, current, socket))

    if (current.timer === undefined) {
      current.timer = this.scheduler.every(this.intervalMs, () => {
        void this.tick(tenantId, current)
      })
    }
  }

  private remove(
    tenantId: string,
    entry: TenantEntry,
    socket: RegistrySocket,
  ): void {
    entry.sockets.delete(socket)

    if (entry.sockets.size === 0) {
      this.scheduler.clear(entry.timer)
      this.tenants.delete(tenantId)
    }
  }

  private async tick(tenantId: string, entry: TenantEntry): Promise<void> {
    if (entry.ticking) {
      return
    }

    entry.ticking = true

    try {
      const keepPolling = await entry.hub.tick(tenantId, [...entry.sockets])

      if (!keepPolling) {
        this.scheduler.clear(entry.timer)
        this.tenants.delete(tenantId)
      }
    } finally {
      entry.ticking = false
    }
  }
}
