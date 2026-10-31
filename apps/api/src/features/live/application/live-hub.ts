export const LIVE_POLL_INTERVAL_MS = 2_000

export type LiveSocket = Readonly<{
  send: (message: string) => void
}>

/** Reads a cheap fingerprint of everything a dashboard displays for a tenant. */
export interface TenantSignaturePort {
  read(tenantId: string): Promise<string>
}

/**
 * Tells connected browsers when their tenant data changed. Only a short
 * "changed" message is pushed: the client reloads through the authenticated
 * API, so no business data ever travels over the socket.
 */
export class LiveHub {
  private lastSignature: string | null = null

  constructor(private readonly port: TenantSignaturePort) {}

  onConnect(socket: LiveSocket): void {
    socket.send('ready')
  }

  onMessage(socket: LiveSocket, message: string): void {
    if (message === 'ping') {
      socket.send('pong')
    }
  }

  /** Returns whether polling must continue (at least one client connected). */
  async tick(
    tenantId: string,
    sockets: readonly LiveSocket[],
  ): Promise<boolean> {
    if (sockets.length === 0) {
      this.lastSignature = null

      return false
    }

    let signature: string

    try {
      signature = await this.port.read(tenantId)
    } catch {
      return true
    }

    if (this.lastSignature !== null && signature !== this.lastSignature) {
      for (const socket of sockets) {
        try {
          socket.send('changed')
        } catch {
          // A closed socket is cleaned up by the runtime close handler.
        }
      }
    }

    this.lastSignature = signature

    return true
  }
}
