import { z } from 'zod'

import { monitorStatusSchema } from './create-monitor.ts'

export const monitorIdSchema = z.uuid()

export const monitorStateSchema = z.strictObject({
  alertAt: z.iso.datetime(),
  alertsEnabled: z.boolean(),
  createdAt: z.iso.datetime(),
  cronExpression: z.string().nullable(),
  cronTimezone: z.string().nullable(),
  description: z.string().nullable(),
  folderId: z.uuid().nullable(),
  graceSeconds: z.number().int().nonnegative(),
  id: z.uuid(),
  incidentOpenedAt: z.iso.datetime().nullable(),
  intervalSeconds: z.number().int().positive(),
  lastHeartbeatAt: z.iso.datetime().nullable(),
  name: z.string().nullable(),
  notes: z.string().nullable(),
  pausedAt: z.iso.datetime().nullable(),
  runningSince: z.iso.datetime().nullable(),
  status: monitorStatusSchema,
  totalPings: z.number().int().nonnegative(),
})

export const listMonitorsResponseSchema = z.strictObject({
  data: z.strictObject({
    monitors: z.array(monitorStateSchema),
  }),
})

export const monitorResponseSchema = z.strictObject({
  data: z.strictObject({
    monitor: monitorStateSchema,
  }),
})

export type MonitorState = z.infer<typeof monitorStateSchema>
export type ListMonitorsResponse = z.infer<typeof listMonitorsResponseSchema>
export type MonitorResponse = z.infer<typeof monitorResponseSchema>
