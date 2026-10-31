import {
  createChannelRequestSchema,
  monitorIdSchema,
  updateChannelRequestSchema,
} from '@vextra/contracts'
import { Hono, type Context } from 'hono'

import {
  ChannelDeliveryError,
  ChannelLimitError,
  ChannelNameTakenError,
  InvalidChannelTargetError,
  type ChannelRecord,
  type ManageChannels,
} from '../../../application/channels.ts'

export type ChannelScope = Readonly<{
  channels: Pick<
    ManageChannels,
    'create' | 'list' | 'remove' | 'setEnabled' | 'test'
  >
  tenantId: string
}>

export type ChannelRoutesDependencies = Readonly<{
  authenticate: (context: Context) => Promise<ChannelScope | null>
}>

type ParseableSchema<T> = Readonly<{
  safeParse: (
    input: unknown,
  ) => Readonly<{ data: T; success: true }> | Readonly<{ success: false }>
}>

function problem(
  context: Context,
  status: 400 | 401 | 404 | 409 | 422 | 500 | 502,
  code: string,
  message: string,
) {
  return context.json({ error: { code, message } }, status)
}

function toResponse(channel: ChannelRecord) {
  return {
    createdAt: new Date(channel.createdAtMs).toISOString(),
    enabled: channel.enabled,
    id: channel.id,
    kind: channel.kind,
    name: channel.name,
    targetHint: channel.targetHint,
  }
}

async function readBody<T>(
  context: Context,
  schema: ParseableSchema<T>,
): Promise<Readonly<{ data: T }> | Readonly<{ response: Response }>> {
  let body: unknown

  try {
    body = await context.req.json()
  } catch {
    return {
      response: problem(
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
        response: problem(
          context,
          422,
          'validation_error',
          'Request validation failed',
        ),
      }
}

function domainError(context: Context, error: unknown) {
  if (error instanceof ChannelNameTakenError) {
    return problem(
      context,
      409,
      'channel_name_taken',
      'A channel with this name already exists',
    )
  }

  if (error instanceof ChannelLimitError) {
    return problem(
      context,
      409,
      'channel_limit_reached',
      'The channel limit has been reached',
    )
  }

  if (error instanceof InvalidChannelTargetError) {
    return problem(
      context,
      422,
      'invalid_channel_target',
      'The destination is not valid for this channel type',
    )
  }

  if (error instanceof ChannelDeliveryError) {
    return problem(
      context,
      502,
      'channel_test_failed',
      'The destination did not accept the test message',
    )
  }

  return problem(context, 500, 'internal_error', 'An unexpected error occurred')
}

export function createChannelRoutes(
  dependencies: ChannelRoutesDependencies,
): Hono {
  const routes = new Hono()

  async function withScope(
    context: Context,
    handler: (scope: ChannelScope) => Promise<Response>,
  ) {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return problem(context, 401, 'unauthorized', 'Authentication required')
    }

    try {
      return await handler(scope)
    } catch (error) {
      return domainError(context, error)
    }
  }

  const notFound = (context: Context) =>
    problem(context, 404, 'channel_not_found', 'Channel not found')

  routes.get('/api/channels', (context) =>
    withScope(context, async (scope) =>
      context.json({
        data: {
          channels: (await scope.channels.list(scope.tenantId)).map(toResponse),
        },
      }),
    ),
  )

  routes.post('/api/channels', (context) =>
    withScope(context, async (scope) => {
      const body = await readBody(context, createChannelRequestSchema)

      if ('response' in body) {
        return body.response
      }

      const channel = await scope.channels.create(scope.tenantId, body.data)

      return context.json({ data: { channel: toResponse(channel) } }, 201)
    }),
  )

  routes.patch('/api/channels/:channelId', (context) =>
    withScope(context, async (scope) => {
      const channelId = monitorIdSchema.safeParse(
        context.req.param('channelId'),
      )

      if (!channelId.success) {
        return notFound(context)
      }

      const body = await readBody(context, updateChannelRequestSchema)

      if ('response' in body) {
        return body.response
      }

      const updated = await scope.channels.setEnabled(
        scope.tenantId,
        channelId.data,
        body.data.enabled,
      )

      return updated ? context.body(null, 204) : notFound(context)
    }),
  )

  routes.delete('/api/channels/:channelId', (context) =>
    withScope(context, async (scope) => {
      const channelId = monitorIdSchema.safeParse(
        context.req.param('channelId'),
      )
      const removed = channelId.success
        ? await scope.channels.remove(scope.tenantId, channelId.data)
        : false

      return removed ? context.body(null, 204) : notFound(context)
    }),
  )

  routes.post('/api/channels/:channelId/test', (context) =>
    withScope(context, async (scope) => {
      const channelId = monitorIdSchema.safeParse(
        context.req.param('channelId'),
      )
      const sent = channelId.success
        ? await scope.channels.test(scope.tenantId, channelId.data)
        : false

      return sent ? context.body(null, 204) : notFound(context)
    }),
  )

  return routes
}
