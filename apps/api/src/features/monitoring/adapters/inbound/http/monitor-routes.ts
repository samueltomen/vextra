import {
  createMonitorRequestSchema,
  monitorIdSchema,
  updateMonitorScheduleRequestSchema,
} from '@cronping/contracts'
import { Hono, type Context } from 'hono'

import type { CreateMonitor } from '../../../application/create-monitor.ts'
import type { MonitorIncidents } from '../../../application/monitor-incidents.ts'
import type { MonitorMetricsService } from '../../../application/monitor-metrics.ts'
import type { MonitorLifecycle } from '../../../application/monitor-lifecycle.ts'
import type {
  MonitorReadService,
  MonitorStateRecord,
} from '../../../application/monitor-read.ts'
import type { RotateMonitorToken } from '../../../application/rotate-monitor-token.ts'
import type { UpdateMonitorSchedule } from '../../../application/update-monitor-schedule.ts'

export type AuthenticatedPrincipal = Readonly<{
  tenantId: string
  userId: string
}>

export type AuthenticatedMonitorScope = Readonly<{
  createMonitor: Pick<CreateMonitor, 'execute'>
  monitorIncidents: Pick<MonitorIncidents, 'list'>
  monitorLifecycle: Pick<MonitorLifecycle, 'delete' | 'pause' | 'resume'>
  monitorMetrics: Pick<MonitorMetricsService, 'get'>
  monitorRead: Pick<MonitorReadService, 'get' | 'list'>
  monitorSchedule: Pick<UpdateMonitorSchedule, 'execute'>
  principal: AuthenticatedPrincipal
  rotateToken: Pick<RotateMonitorToken, 'execute'>
}>

export type MonitorRoutesDependencies = Readonly<{
  authenticate: (context: Context) => Promise<AuthenticatedMonitorScope | null>
}>

export function createMonitorRoutes(
  dependencies: MonitorRoutesDependencies,
): Hono {
  const routes = new Hono()

  routes.get('/api/monitors', async (context) => {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return unauthorized(context)
    }

    try {
      const monitors = await scope.monitorRead.list(scope.principal.tenantId)

      return context.json({
        data: {
          monitors: monitors.map(toMonitorResponse),
        },
      })
    } catch {
      return internalError(context)
    }
  })

  routes.get('/api/monitors/:monitorId', async (context) => {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return unauthorized(context)
    }

    const parsedId = monitorIdSchema.safeParse(context.req.param('monitorId'))

    if (!parsedId.success) {
      return monitorNotFound(context)
    }

    try {
      const monitor = await scope.monitorRead.get(
        scope.principal.tenantId,
        parsedId.data,
      )

      if (!monitor) {
        return monitorNotFound(context)
      }

      return context.json({
        data: {
          monitor: toMonitorResponse(monitor),
        },
      })
    } catch {
      return internalError(context)
    }
  })

  routes.post('/api/monitors', async (context) => {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return unauthorized(context)
    }

    const parsed = await parseJsonBody(context, createMonitorRequestSchema)

    if ('response' in parsed) {
      return parsed.response
    }

    try {
      const result = await scope.createMonitor.execute({
        tenantId: scope.principal.tenantId,
        intervalSeconds: parsed.data.intervalSeconds,
        graceSeconds: parsed.data.graceSeconds,
      })

      return context.json(
        {
          data: {
            id: result.monitor.id,
            intervalSeconds: result.monitor.intervalSeconds,
            graceSeconds: result.monitor.graceSeconds,
            status: result.monitor.status,
            alertAt: new Date(result.monitor.alertAtMs).toISOString(),
            heartbeatToken: result.heartbeatToken,
          },
        },
        201,
        {
          Location: `/api/monitors/${result.monitor.id}`,
        },
      )
    } catch (error) {
      if (error instanceof RangeError) {
        return context.json(
          {
            error: {
              code: 'validation_error',
              message: 'Request validation failed',
            },
          },
          422,
        )
      }

      return internalError(context)
    }
  })

  routes.get('/api/monitors/:monitorId/incidents', async (context) => {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return unauthorized(context)
    }

    const parsedId = monitorIdSchema.safeParse(context.req.param('monitorId'))

    if (!parsedId.success) {
      return monitorNotFound(context)
    }

    try {
      const incidents = await scope.monitorIncidents.list(parsedId.data)

      return context.json({
        data: {
          incidents: incidents.map(toIncidentResponse),
        },
      })
    } catch {
      return internalError(context)
    }
  })

  routes.get('/api/monitors/:monitorId/metrics', async (context) => {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return unauthorized(context)
    }

    const parsedId = monitorIdSchema.safeParse(context.req.param('monitorId'))

    if (!parsedId.success) {
      return monitorNotFound(context)
    }

    try {
      const metrics = await scope.monitorMetrics.get(
        scope.principal.tenantId,
        parsedId.data,
      )

      return metrics
        ? context.json({ data: metrics })
        : monitorNotFound(context)
    } catch {
      return internalError(context)
    }
  })

  routes.post('/api/monitors/:monitorId/pause', async (context) => {
    return lifecycleAction(
      context,
      dependencies.authenticate,
      (lifecycle, monitorId) => lifecycle.pause(monitorId),
    )
  })

  routes.post('/api/monitors/:monitorId/resume', async (context) => {
    return lifecycleAction(
      context,
      dependencies.authenticate,
      (lifecycle, monitorId) => lifecycle.resume(monitorId),
    )
  })

  routes.patch('/api/monitors/:monitorId', async (context) => {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return unauthorized(context)
    }

    const parsedId = monitorIdSchema.safeParse(context.req.param('monitorId'))

    if (!parsedId.success) {
      return monitorNotFound(context)
    }

    const parsed = await parseJsonBody(
      context,
      updateMonitorScheduleRequestSchema,
    )

    if ('response' in parsed) {
      return parsed.response
    }

    try {
      const updated = await scope.monitorSchedule.execute({
        graceSeconds: parsed.data.graceSeconds,
        intervalSeconds: parsed.data.intervalSeconds,
        monitorId: parsedId.data,
      })

      if (!updated) {
        return monitorNotFound(context)
      }

      const monitor = await scope.monitorRead.get(
        scope.principal.tenantId,
        parsedId.data,
      )

      return monitor
        ? context.json({ data: { monitor: toMonitorResponse(monitor) } })
        : monitorNotFound(context)
    } catch (error) {
      if (error instanceof RangeError) {
        return context.json(
          {
            error: {
              code: 'validation_error',
              message: 'Request validation failed',
            },
          },
          422,
        )
      }

      return internalError(context)
    }
  })

  routes.delete('/api/monitors/:monitorId', async (context) => {
    return lifecycleAction(
      context,
      dependencies.authenticate,
      (lifecycle, monitorId) => lifecycle.delete(monitorId),
    )
  })

  routes.post('/api/monitors/:monitorId/rotate-token', async (context) => {
    const scope = await dependencies.authenticate(context)

    if (!scope) {
      return unauthorized(context)
    }

    const parsedId = monitorIdSchema.safeParse(context.req.param('monitorId'))

    if (!parsedId.success) {
      return monitorNotFound(context)
    }

    try {
      const heartbeatToken = await scope.rotateToken.execute(parsedId.data)

      return heartbeatToken
        ? context.json({ data: { heartbeatToken } })
        : monitorNotFound(context)
    } catch {
      return internalError(context)
    }
  })

  return routes
}

type ParseableSchema<T> = Readonly<{
  safeParse(input: unknown):
    | Readonly<{ data: T; success: true }>
    | Readonly<{
        error: Readonly<{
          issues: readonly Readonly<{
            code: string
            message: string
            path: readonly PropertyKey[]
          }>[]
        }>
        success: false
      }>
}>

async function parseJsonBody<T>(
  context: Context,
  schema: ParseableSchema<T>,
): Promise<Readonly<{ data: T }> | Readonly<{ response: Response }>> {
  let body: unknown

  try {
    body = await context.req.json()
  } catch {
    return {
      response: context.json(
        {
          error: {
            code: 'invalid_json',
            message: 'Request body must be valid JSON',
          },
        },
        400,
      ),
    }
  }

  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return {
      response: context.json(
        {
          error: {
            code: 'validation_error',
            message: 'Request validation failed',
            details: parsed.error.issues.map((issue) => ({
              code: issue.code,
              field: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        422,
      ),
    }
  }

  return { data: parsed.data }
}

async function lifecycleAction(
  context: Context,
  authenticate: MonitorRoutesDependencies['authenticate'],
  action: (
    lifecycle: AuthenticatedMonitorScope['monitorLifecycle'],
    monitorId: string,
  ) => Promise<boolean>,
) {
  const scope = await authenticate(context)

  if (!scope) {
    return unauthorized(context)
  }

  const parsedId = monitorIdSchema.safeParse(context.req.param('monitorId'))

  if (!parsedId.success) {
    return monitorNotFound(context)
  }

  try {
    const changed = await action(scope.monitorLifecycle, parsedId.data)

    return changed ? context.body(null, 204) : monitorNotFound(context)
  } catch {
    return internalError(context)
  }
}

function toMonitorResponse(monitor: MonitorStateRecord) {
  return {
    alertAt: new Date(monitor.alertAtMs).toISOString(),
    createdAt: new Date(monitor.createdAtMs).toISOString(),
    folderId: monitor.folderId,
    graceSeconds: monitor.graceSeconds,
    id: monitor.id,
    incidentOpenedAt:
      monitor.incidentOpenedAtMs === null
        ? null
        : new Date(monitor.incidentOpenedAtMs).toISOString(),
    intervalSeconds: monitor.intervalSeconds,
    lastHeartbeatAt:
      monitor.lastHeartbeatAtMs === null
        ? null
        : new Date(monitor.lastHeartbeatAtMs).toISOString(),
    pausedAt:
      monitor.pausedAtMs === null
        ? null
        : new Date(monitor.pausedAtMs).toISOString(),
    status: monitor.status,
    totalPings: monitor.totalPings,
  }
}

function toIncidentResponse(
  incident: Awaited<ReturnType<MonitorIncidents['list']>>[number],
) {
  return {
    id: incident.id,
    monitorId: incident.monitorId,
    openedAt: new Date(incident.openedAtMs).toISOString(),
    reason: incident.reason,
    resolutionReason: incident.resolutionReason,
    resolvedAt:
      incident.resolvedAtMs === null
        ? null
        : new Date(incident.resolvedAtMs).toISOString(),
  }
}

function unauthorized(context: Context) {
  return context.json(
    {
      error: {
        code: 'unauthorized',
        message: 'Authentication required',
      },
    },
    401,
  )
}

function monitorNotFound(context: Context) {
  return context.json(
    {
      error: {
        code: 'monitor_not_found',
        message: 'Monitor not found',
      },
    },
    404,
  )
}

function internalError(context: Context) {
  return context.json(
    {
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
      },
    },
    500,
  )
}
