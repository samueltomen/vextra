import { z } from 'zod'

export const monitorIncidentSchema = z.strictObject({
  id: z.uuid(),
  monitorId: z.uuid(),
  openedAt: z.iso.datetime(),
  reason: z.literal('heartbeat_missed'),
  resolutionReason: z
    .union([z.literal('heartbeat_received'), z.literal('manual')])
    .nullable(),
  resolvedAt: z.iso.datetime().nullable(),
})

export const listMonitorIncidentsResponseSchema = z.strictObject({
  data: z.strictObject({
    incidents: z.array(monitorIncidentSchema),
  }),
})

export type MonitorIncident = z.infer<typeof monitorIncidentSchema>
export type ListMonitorIncidentsResponse = z.infer<
  typeof listMonitorIncidentsResponseSchema
>
