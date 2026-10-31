import type { RateLimitBinding } from '../rate-limit/rate-limit-guard.ts'

const CLEANUP_THRESHOLD = 10_000

type Window = { count: number; startedAtMs: number }

/**
 * Fixed-window limiter kept in memory. It replaces the Cloudflare Rate Limiting
 * binding for self-hosted installations, which run as a single process.
 */
export function createMemoryRateLimitBinding(
  options: Readonly<{
    limit: number
    nowMs?: () => number
    periodSeconds: number
  }>,
): RateLimitBinding {
  const windows = new Map<string, Window>()
  const periodMs = options.periodSeconds * 1_000
  const nowMs = options.nowMs ?? Date.now

  return {
    async limit({ key }) {
      const now = nowMs()

      if (windows.size > CLEANUP_THRESHOLD) {
        for (const [candidate, window] of windows) {
          if (now - window.startedAtMs >= periodMs) {
            windows.delete(candidate)
          }
        }
      }

      const current = windows.get(key)

      if (!current || now - current.startedAtMs >= periodMs) {
        windows.set(key, { count: 1, startedAtMs: now })

        return { success: true }
      }

      current.count += 1

      return { success: current.count <= options.limit }
    },
  }
}
