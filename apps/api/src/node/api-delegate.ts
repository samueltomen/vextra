import type { Context, Hono } from 'hono'

/**
 * Serves `/api/*` with a freshly built API for every request.
 *
 * A Cloudflare Worker rebuilds the API per request, so Supabase clients never
 * outlive a request. In a long-lived Node process a shared client would keep
 * the session of the last user who signed in and reuse it for unauthenticated
 * calls such as heartbeats, so the same isolation is enforced here.
 */
export function createApiDelegate<Environment>(
  createApi: () => Hono,
  environment: Environment,
) {
  return async (context: Context): Promise<Response> => {
    const response = await createApi().fetch(context.req.raw, environment)

    // Unknown routes answer in JSON like the rest of the API.
    if (
      response.status === 404 &&
      response.headers.get('content-type')?.startsWith('text/plain')
    ) {
      return context.json(
        { error: { code: 'not_found', message: 'Route not found' } },
        404,
      )
    }

    return response
  }
}
