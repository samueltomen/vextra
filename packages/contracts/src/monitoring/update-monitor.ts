import { z } from 'zod'

import { MAX_GRACE_SECONDS, MAX_INTERVAL_SECONDS } from './create-monitor.ts'

export const updateMonitorScheduleRequestSchema = z.strictObject({
  intervalSeconds: z.number().int().min(60).max(MAX_INTERVAL_SECONDS),
  graceSeconds: z.number().int().min(0).max(MAX_GRACE_SECONDS),
})

export type UpdateMonitorScheduleRequest = z.infer<
  typeof updateMonitorScheduleRequestSchema
>
