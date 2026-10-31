import { z } from 'zod'

import {
  cronScheduleRequestSchema,
  intervalScheduleRequestSchema,
} from './create-monitor.ts'

export const updateMonitorScheduleRequestSchema = z.union([
  intervalScheduleRequestSchema,
  cronScheduleRequestSchema,
])

export type UpdateMonitorScheduleRequest = z.infer<
  typeof updateMonitorScheduleRequestSchema
>

export const MAX_MONITOR_NAME_LENGTH = 80
export const MAX_MONITOR_DESCRIPTION_LENGTH = 200
export const MAX_MONITOR_NOTES_LENGTH = 2000

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()

export const updateMonitorDetailsRequestSchema = z
  .strictObject({
    alertsEnabled: z.boolean(),
    description: optionalText(MAX_MONITOR_DESCRIPTION_LENGTH),
    name: optionalText(MAX_MONITOR_NAME_LENGTH),
    notes: optionalText(MAX_MONITOR_NOTES_LENGTH),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'No change requested')

export type UpdateMonitorDetailsRequest = z.infer<
  typeof updateMonitorDetailsRequestSchema
>
