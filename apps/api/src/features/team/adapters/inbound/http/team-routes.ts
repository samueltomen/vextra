import {
  acceptInvitationRequestSchema,
  changeMemberRoleRequestSchema,
  inviteMemberRequestSchema,
  monitorIdSchema,
} from '@vextra/contracts'
import { Hono, type Context } from 'hono'

import {
  InvitationExistsError,
  InvitationLimitError,
  TeamForbiddenError,
  type ManageTeam,
} from '../../../application/team.ts'

export type TeamScope = Readonly<{
  role: 'member' | 'owner' | 'viewer'
  team: Pick<
    ManageTeam,
    | 'accept'
    | 'invite'
    | 'listInvitations'
    | 'listMembers'
    | 'listSpaces'
    | 'removeMember'
    | 'revokeInvitation'
    | 'setRole'
  >
  tenantId: string
  userId: string
}>

export type TeamRoutesDependencies = Readonly<{
  authenticate: (context: Context) => Promise<TeamScope | null>
}>

function errorBody(
  context: Context,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 500,
  code: string,
  message: string,
) {
  return context.json({ error: { code, message } }, status)
}

export function createTeamRoutes(dependencies: TeamRoutesDependencies): Hono {
  const routes = new Hono()

  async function withScope(
    context: Context,
    handler: (scope: TeamScope) => Promise<Response>,
  ): Promise<Response> {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return errorBody(context, 401, 'unauthorized', 'Authentication required')
    }

    try {
      return await handler(scope)
    } catch (error) {
      if (error instanceof TeamForbiddenError) {
        return errorBody(context, 403, 'forbidden', 'Owner role required')
      }

      if (error instanceof InvitationExistsError) {
        return errorBody(context, 409, 'invitation_exists', 'Already invited')
      }

      if (error instanceof InvitationLimitError) {
        return errorBody(context, 409, 'limit_reached', 'Too many invitations')
      }

      return errorBody(context, 500, 'internal_error', 'Request failed')
    }
  }

  async function readJson(context: Context): Promise<unknown | undefined> {
    try {
      return await context.req.json()
    } catch {
      return undefined
    }
  }

  routes.get('/api/team/spaces', (context) =>
    withScope(context, async (scope) =>
      context.json({ data: { spaces: await scope.team.listSpaces() } }),
    ),
  )

  routes.get('/api/team/members', (context) =>
    withScope(context, async (scope) =>
      context.json({
        data: {
          members: await scope.team.listMembers(scope.tenantId),
          role: scope.role,
          userId: scope.userId,
        },
      }),
    ),
  )

  routes.patch('/api/team/members/:userId', (context) =>
    withScope(context, async (scope) => {
      const userId = monitorIdSchema.safeParse(context.req.param('userId'))
      const body = changeMemberRoleRequestSchema.safeParse(
        await readJson(context),
      )

      if (!userId.success || !body.success) {
        return errorBody(context, 422, 'validation_failed', 'Invalid request')
      }

      return (await scope.team.setRole(
        scope.tenantId,
        userId.data,
        body.data.role,
      ))
        ? context.body(null, 204)
        : errorBody(context, 404, 'not_found', 'Member not found')
    }),
  )

  routes.delete('/api/team/members/:userId', (context) =>
    withScope(context, async (scope) => {
      const userId = monitorIdSchema.safeParse(context.req.param('userId'))

      if (!userId.success) {
        return errorBody(context, 404, 'not_found', 'Member not found')
      }

      return (await scope.team.removeMember(scope.tenantId, userId.data))
        ? context.body(null, 204)
        : errorBody(context, 404, 'not_found', 'Member not found')
    }),
  )

  routes.get('/api/team/invitations', (context) =>
    withScope(context, async (scope) =>
      context.json({
        data: {
          // Pending invitations are an owner-only view (also enforced by RLS).
          invitations:
            scope.role === 'owner'
              ? await scope.team.listInvitations(scope.tenantId)
              : [],
        },
      }),
    ),
  )

  routes.post('/api/team/invitations', (context) =>
    withScope(context, async (scope) => {
      const body = inviteMemberRequestSchema.safeParse(await readJson(context))

      if (!body.success) {
        return errorBody(context, 422, 'validation_failed', 'Invalid request')
      }

      return context.json(
        {
          data: await scope.team.invite({
            ...body.data,
            invitedBy: scope.userId,
            tenantId: scope.tenantId,
          }),
        },
        201,
      )
    }),
  )

  routes.post('/api/team/invitations/accept', (context) =>
    withScope(context, async (scope) => {
      const body = acceptInvitationRequestSchema.safeParse(
        await readJson(context),
      )

      if (!body.success) {
        return errorBody(context, 422, 'validation_failed', 'Invalid request')
      }

      const tenantId = await scope.team.accept(body.data.token)

      // One answer for unknown, expired, used or foreign invitations.
      return tenantId
        ? context.json({ data: { tenantId } })
        : errorBody(context, 404, 'invitation_invalid', 'Invitation unusable')
    }),
  )

  routes.delete('/api/team/invitations/:invitationId', (context) =>
    withScope(context, async (scope) => {
      const id = monitorIdSchema.safeParse(context.req.param('invitationId'))

      if (!id.success) {
        return errorBody(context, 404, 'not_found', 'Invitation not found')
      }

      return (await scope.team.revokeInvitation(scope.tenantId, id.data))
        ? context.body(null, 204)
        : errorBody(context, 404, 'not_found', 'Invitation not found')
    }),
  )

  return routes
}
