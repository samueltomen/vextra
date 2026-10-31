import { z } from 'zod'

export const MAX_INTERVAL_SECONDS = 31_536_000
export const MAX_GRACE_SECONDS = 604_800

export function isSupportedTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })

    return true
  } catch {
    return false
  }
}

const graceSecondsSchema = z.number().int().min(0).max(MAX_GRACE_SECONDS)

/** A fixed interval between two heartbeats. */
export const intervalScheduleRequestSchema = z.strictObject({
  intervalSeconds: z.number().int().min(60).max(MAX_INTERVAL_SECONDS),
  graceSeconds: graceSecondsSchema,
})

/** A five-field cron expression evaluated in an IANA time zone. */
export const cronScheduleRequestSchema = z.strictObject({
  cron: z.string().trim().min(1).max(120),
  graceSeconds: graceSecondsSchema,
  timezone: z
    .string()
    .min(1)
    .max(64)
    .refine(isSupportedTimeZone, 'Unsupported time zone'),
})

export const createMonitorRequestSchema = z.union([
  intervalScheduleRequestSchema,
  cronScheduleRequestSchema,
])

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
