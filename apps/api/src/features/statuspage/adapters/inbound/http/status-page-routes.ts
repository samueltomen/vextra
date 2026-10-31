import {
  saveStatusPageRequestSchema,
  statusPageSlugSchema,
} from '@vextra/contracts'
import { Hono, type Context } from 'hono'

import {
  StatusPageSlugTakenError,
  type ManageStatusPage,
  type ReadPublicStatusPage,
} from '../../../application/status-page.ts'

export type StatusPageScope = Readonly<{
  settings: Pick<ManageStatusPage, 'get' | 'save'>
  tenantId: string
}>

export type StatusPageRoutesDependencies = Readonly<{
  authenticate: (context: Context) => Promise<StatusPageScope | null>
  publicPage: Pick<ReadPublicStatusPage, 'read'>
}>

function errorBody(
  context: Context,
  status: 400 | 401 | 404 | 409 | 422 | 500,
  code: string,
  message: string,
) {
  return context.json({ error: { code, message } }, status)
}

export function createStatusPageRoutes(
  dependencies: StatusPageRoutesDependencies,
): Hono {
  const routes = new Hono()

  routes.get('/api/status-page', async (context) => {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return errorBody(context, 401, 'unauthorized', 'Authentication required')
    }

    try {
      return context.json({ data: await scope.settings.get(scope.tenantId) })
    } catch {
      return errorBody(context, 500, 'internal_error', 'Request failed')
    }
  })

  routes.put('/api/status-page', async (context) => {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return errorBody(context, 401, 'unauthorized', 'Authentication required')
    }

    let body: unknown

    try {
      body = await context.req.json()
    } catch {
      return errorBody(
        context,
        400,
        'invalid_json',
        'Request body must be valid JSON',
      )
    }

    const parsed = saveStatusPageRequestSchema.safeParse(body)

    if (!parsed.success) {
      return errorBody(
        context,
        422,
        'validation_failed',
        'The status page values are invalid',
      )
    }

    try {
      return context.json({
        data: await scope.settings.save(scope.tenantId, parsed.data),
      })
    } catch (error) {
      if (error instanceof StatusPageSlugTakenError) {
        return errorBody(context, 409, 'slug_taken', 'This address is taken')
      }

      return errorBody(context, 500, 'internal_error', 'Request failed')
    }
  })

  routes.get('/api/status/:slug', async (context) => {
    const slug = statusPageSlugSchema.safeParse(context.req.param('slug'))

    if (!slug.success) {
      return errorBody(context, 404, 'not_found', 'Status page not found')
    }

    try {
      const page = await dependencies.publicPage.read(slug.data)

      return page
        ? context.json({ data: page })
        : errorBody(context, 404, 'not_found', 'Status page not found')
    } catch {
      return errorBody(context, 500, 'internal_error', 'Request failed')
    }
  })

  return routes
}
