import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

export type LiveStatus = 'connecting' | 'live' | 'offline'

const PING_INTERVAL_MS = 25_000
const MAX_BACKOFF_MS = 30_000

function liveUrl(): string {
  const url = new URL('/api/live', window.location.href)

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'

  return url.toString()
}

/**
 * Keeps a WebSocket open to the API. The server only says "something changed";
 * every active query is then reloaded through the normal authenticated API.
 */
export function useLiveUpdates(enabled: boolean): LiveStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>('connecting')

  useEffect(() => {
    if (!enabled || typeof WebSocket === 'undefined') {
      return undefined
    }

    let disposed = false
    let socket: WebSocket | null = null
    let reconnectTimer: number | undefined
    let pingTimer: number | undefined
    let attempt = 0

    function connect() {
      setStatus('connecting')
      socket = new WebSocket(liveUrl())

      socket.onopen = () => {
        attempt = 0
        window.clearInterval(pingTimer)
        pingTimer = window.setInterval(
          () => socket?.send('ping'),
          PING_INTERVAL_MS,
        )
      }

      socket.onmessage = (event: MessageEvent) => {
        if (event.data === 'ready' || event.data === 'changed') {
          setStatus('live')
          void queryClient.invalidateQueries()
        }
      }

      socket.onclose = () => {
        window.clearInterval(pingTimer)

        if (disposed) {
          return
        }

        setStatus('offline')
        attempt += 1
        reconnectTimer = window.setTimeout(
          connect,
          Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** (attempt - 1)),
        )
      }
    }

    connect()

    return () => {
      disposed = true
      window.clearTimeout(reconnectTimer)
      window.clearInterval(pingTimer)
      socket?.close()
    }
  }, [enabled, queryClient])

  return enabled ? status : 'offline'
}
