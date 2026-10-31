import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLiveUpdates } from './use-live-updates.ts'

class FakeSocket {
  static instances: FakeSocket[] = []

  onclose: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onopen: (() => void) | null = null
  sent: string[] = []

  constructor(readonly url: string) {
    FakeSocket.instances.push(this)
  }

  close() {
    this.onclose = null
  }

  send(message: string) {
    this.sent.push(message)
  }
}

function setup(enabled = true) {
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return {
    invalidate,
    ...renderHook(() => useLiveUpdates(enabled), { wrapper }),
  }
}

describe('useLiveUpdates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeSocket.instances = []
    vi.stubGlobal('WebSocket', FakeSocket)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens a same-origin WebSocket and reloads queries when told', () => {
    const { invalidate, result } = setup()
    const socket = FakeSocket.instances[0]!

    expect(socket.url).toMatch(/^ws:\/\/.+\/api\/live$/u)
    expect(result.current).toBe('connecting')

    act(() => socket.onmessage?.({ data: 'ready' }))
    expect(result.current).toBe('live')
    expect(invalidate).toHaveBeenCalledTimes(1)

    act(() => socket.onmessage?.({ data: 'changed' }))
    expect(invalidate).toHaveBeenCalledTimes(2)

    act(() => socket.onmessage?.({ data: 'pong' }))
    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it('sends keep-alive pings while connected', () => {
    setup()
    const socket = FakeSocket.instances[0]!

    act(() => socket.onopen?.())
    act(() => {
      vi.advanceTimersByTime(25_000)
    })

    expect(socket.sent).toEqual(['ping'])
  })

  it('reconnects with a growing delay after the connection drops', () => {
    const { result } = setup()

    act(() => FakeSocket.instances[0]!.onclose?.())
    expect(result.current).toBe('offline')
    expect(FakeSocket.instances).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(FakeSocket.instances).toHaveLength(2)

    act(() => FakeSocket.instances[1]!.onclose?.())
    act(() => {
      vi.advanceTimersByTime(1_999)
    })
    expect(FakeSocket.instances).toHaveLength(2)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(FakeSocket.instances).toHaveLength(3)
  })

  it('does not connect when disabled', () => {
    const { result } = setup(false)

    expect(FakeSocket.instances).toHaveLength(0)
    expect(result.current).toBe('offline')
  })
})
