import type { MiddlewareHandler } from 'hono'

export const RATE_LIMIT_WINDOW_SECONDS = 60

export type RateLimiter = Readonly<{
  allow: (key: string) => Promise<boolean>
}>

export type RateLimitBinding = Readonly<{
  limit: (options: { key: string }) => Promise<{ success: boolean }>
}>

export function createCloudflareRateLimiter(
  binding: RateLimitBinding,
): RateLimiter {
  return {
    allow: async (key) => (await binding.limit({ key })).success,
  }
}

export function createRateLimitGuard(
  options: Readonly<{ limiter: RateLimiter; scope: string }>,
): MiddlewareHandler {
  return async (context, next) => {
    if (context.req.method !== 'POST') {
      return next()
    }

    const clientIp = context.req.header('cf-connecting-ip') ?? 'unknown'
    const allowed = await options.limiter
      .allow(`${options.scope}:${clientIp}`)
      // Fail open: a limiter outage must never reject legitimate heartbeats.
      .catch(() => true)

    if (!allowed) {
      context.header('Retry-After', String(RATE_LIMIT_WINDOW_SECONDS))

      return context.json(
        { error: { code: 'rate_limited', message: 'Too many requests' } },
        429,
      )
    }

    return next()
  }
}
