import { z } from 'zod'

export const MAX_INTERVAL_SECONDS = 31_536_000
export const MAX_GRACE_SECONDS = 604_800

export const createMonitorRequestSchema = z.strictObject({
  intervalSeconds: z.number().int().min(60).max(MAX_INTERVAL_SECONDS),
  graceSeconds: z.number().int().min(0).max(MAX_GRACE_SECONDS),
})

export type CreateMonitorRequest = z.infer<typeof createMonitorRequestSchema>

export const monitorStatusSchema = z.enum([
  'pending',
  'healthy',
  'late',
  'paused',
])

export const createMonitorResponseSchema = z.strictObject({
  data: z.strictObject({
    id: z.string().min(1),
    intervalSeconds: z.number().int().positive(),
    graceSeconds: z.number().int().nonnegative(),
    status: monitorStatusSchema,
    alertAt: z.iso.datetime(),
    heartbeatToken: z.string().min(1),
  }),
})

export type CreateMonitorResponse = z.infer<typeof createMonitorResponseSchema>
