import type { MiddlewareHandler } from 'hono'

const MUTATING_METHODS = new Set(['DELETE', 'PATCH', 'POST', 'PUT'])

export function normalizeOrigin(value: string): string {
  return new URL(value).origin
}

export function createOriginGuard(allowedOrigin: string): MiddlewareHandler {
  const normalizedOrigin = normalizeOrigin(allowedOrigin)

  return async (context, next) => {
    if (
      MUTATING_METHODS.has(context.req.method) &&
      context.req.header('origin') !== normalizedOrigin
    ) {
      return context.json(
        {
          error: {
            code: 'origin_rejected',
            message: 'Request origin is not allowed',
          },
        },
        403,
      )
    }

    await next()
  }
}
