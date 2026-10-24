import { useEffect, useState } from 'react'

export function useNow(intervalMs = 30_000): number {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), intervalMs)

    return () => window.clearInterval(interval)
  }, [intervalMs])

  return nowMs
}
