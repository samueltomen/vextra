import {
  folderNameRequestSchema,
  monitorIdSchema,
  setMonitorFolderRequestSchema,
  updateMonitorDetailsRequestSchema,
  updatePreferencesRequestSchema,
} from '@vextra/contracts'
import { Hono, type Context } from 'hono'

import {
  FolderLimitError,
  FolderNameTakenError,
  FolderNotFoundError,
  type AccountPreferencesService,
  type ManageFolders,
  type ManageMonitorDetails,
  type MonitorDetailsChanges,
  type PreferencesRecord,
} from '../../../application/workspace.ts'

export type WorkspaceScope = Readonly<{
  details: Pick<ManageMonitorDetails, 'update'>
  folders: Pick<
    ManageFolders,
    'assign' | 'create' | 'list' | 'remove' | 'rename'
  >
  preferences: Pick<AccountPreferencesService, 'get' | 'update'>
  tenantId: string
}>

export type WorkspaceRoutesDependencies = Readonly<{
  authenticate: (context: Context) => Promise<WorkspaceScope | null>
}>

function errorBody(
  context: Context,
  status: 400 | 401 | 404 | 409 | 422 | 500,
  code: string,
  message: string,
) {
  return context.json({ error: { code, message } }, status)
}

type ParseableSchema<T> = Readonly<{
  safeParse: (
    input: unknown,
  ) => Readonly<{ data: T; success: true }> | Readonly<{ success: false }>
}>

async function readBody<T>(
  context: Context,
  schema: ParseableSchema<T>,
): Promise<Readonly<{ data: T }> | Readonly<{ response: Response }>> {
  let body: unknown

  try {
    body = await context.req.json()
  } catch {
    return {
      response: errorBody(
        context,
        400,
        'invalid_json',
        'Request body must be valid JSON',
      ),
    }
  }

  const parsed = schema.safeParse(body)

  return parsed.success
    ? { data: parsed.data }
    : {
        response: errorBody(
          context,
          422,
          'validation_error',
          'Request validation failed',
        ),
      }
}

function domainError(context: Context, error: unknown) {
  if (error instanceof FolderNameTakenError) {
    return errorBody(
      context,
      409,
      'folder_name_taken',
      'A folder with this name already exists',
    )
  }

  if (error instanceof FolderLimitError) {
    return errorBody(
      context,
      409,
      'folder_limit_reached',
      'The folder limit has been reached',
    )
  }

  if (error instanceof FolderNotFoundError) {
    return errorBody(context, 404, 'folder_not_found', 'Folder not found')
  }

  return errorBody(
    context,
    500,
    'internal_error',
    'An unexpected error occurred',
  )
}

export function createWorkspaceRoutes(
  dependencies: WorkspaceRoutesDependencies,
): Hono {
  const routes = new Hono()

  async function withScope(
    context: Context,
    handler: (scope: WorkspaceScope) => Promise<Response>,
  ) {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return errorBody(context, 401, 'unauthorized', 'Authentication required')
    }

    try {
      return await handler(scope)
    } catch (error) {
      return domainError(context, error)
    }
  }

  routes.get('/api/folders', (context) =>
    withScope(context, async (scope) =>
      context.json({
        data: { folders: await scope.folders.list(scope.tenantId) },
      }),
    ),
  )

  routes.post('/api/folders', (context) =>
    withScope(context, async (scope) => {
      const body = await readBody(context, folderNameRequestSchema)

      if ('response' in body) {
        return body.response
      }

      const folder = await scope.folders.create(scope.tenantId, body.data.name)

      return context.json({ data: { folder } }, 201)
    }),
  )

  routes.patch('/api/folders/:folderId', (context) =>
    withScope(context, async (scope) => {
      const folderId = monitorIdSchema.safeParse(context.req.param('folderId'))

      if (!folderId.success) {
        return errorBody(context, 404, 'folder_not_found', 'Folder not found')
      }

      const body = await readBody(context, folderNameRequestSchema)

      if ('response' in body) {
        return body.response
      }

      const folder = await scope.folders.rename(
        scope.tenantId,
        folderId.data,
        body.data.name,
      )

      return folder
        ? context.json({ data: { folder } })
        : errorBody(context, 404, 'folder_not_found', 'Folder not found')
    }),
  )

  routes.delete('/api/folders/:folderId', (context) =>
    withScope(context, async (scope) => {
      const folderId = monitorIdSchema.safeParse(context.req.param('folderId'))
      const removed = folderId.success
        ? await scope.folders.remove(scope.tenantId, folderId.data)
        : false

      return removed
        ? context.body(null, 204)
        : errorBody(context, 404, 'folder_not_found', 'Folder not found')
    }),
  )

  routes.put('/api/monitors/:monitorId/folder', (context) =>
    withScope(context, async (scope) => {
      const monitorId = monitorIdSchema.safeParse(
        context.req.param('monitorId'),
      )

      if (!monitorId.success) {
        return errorBody(context, 404, 'monitor_not_found', 'Monitor not found')
      }

      const body = await readBody(context, setMonitorFolderRequestSchema)

      if ('response' in body) {
        return body.response
      }

      const assigned = await scope.folders.assign(
        scope.tenantId,
        monitorId.data,
        body.data.folderId,
      )

      return assigned
        ? context.body(null, 204)
        : errorBody(context, 404, 'monitor_not_found', 'Monitor not found')
    }),
  )

  routes.patch('/api/monitors/:monitorId/details', (context) =>
    withScope(context, async (scope) => {
      const monitorId = monitorIdSchema.safeParse(
        context.req.param('monitorId'),
      )

      if (!monitorId.success) {
        return errorBody(context, 404, 'monitor_not_found', 'Monitor not found')
      }

      const body = await readBody(context, updateMonitorDetailsRequestSchema)

      if ('response' in body) {
        return body.response
      }

      const changes = Object.fromEntries(
        Object.entries(body.data).filter(([, value]) => value !== undefined),
      ) as MonitorDetailsChanges
      const updated = await scope.details.update(
        scope.tenantId,
        monitorId.data,
        changes,
      )

      return updated
        ? context.body(null, 204)
        : errorBody(context, 404, 'monitor_not_found', 'Monitor not found')
    }),
  )

  routes.get('/api/preferences', (context) =>
    withScope(context, async (scope) =>
      context.json({
        data: { preferences: await scope.preferences.get(scope.tenantId) },
      }),
    ),
  )

  routes.patch('/api/preferences', (context) =>
    withScope(context, async (scope) => {
      const body = await readBody(context, updatePreferencesRequestSchema)

      if ('response' in body) {
        return body.response
      }

      const changes = Object.fromEntries(
        Object.entries(body.data).filter(([, value]) => value !== undefined),
      ) as Partial<PreferencesRecord>

      return context.json({
        data: {
          preferences: await scope.preferences.update(scope.tenantId, changes),
        },
      })
    }),
  )

  return routes
}
