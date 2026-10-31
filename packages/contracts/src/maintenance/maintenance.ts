import { z } from 'zod'

export const MAX_MAINTENANCE_DAYS = 30

export const createMaintenanceRequestSchema = z
  .strictObject({
    endsAt: z.iso.datetime(),
    monitorId: z.uuid().nullable(),
    name: z.string().trim().min(1).max(80),
    startsAt: z.iso.datetime(),
  })
  .refine(
    (value) => Date.parse(value.endsAt) > Date.parse(value.startsAt),
    'The window must end after it starts',
  )
  .refine(
    (value) =>
      Date.parse(value.endsAt) - Date.parse(value.startsAt) <=
      MAX_MAINTENANCE_DAYS * 86_400_000,
    'The window cannot exceed 30 days',
  )

export type CreateMaintenanceRequest = z.infer<
  typeof createMaintenanceRequestSchema
>

export const maintenanceWindowSchema = z.object({
  endsAt: z.string(),
  id: z.string(),
  monitorId: z.string().nullable(),
  name: z.string(),
  startsAt: z.string(),
})

export const listMaintenanceResponseSchema = z.object({
  data: z.object({ windows: z.array(maintenanceWindowSchema) }),
})

export type MaintenanceWindow = z.infer<typeof maintenanceWindowSchema>
export type ListMaintenanceResponse = z.infer<
  typeof listMaintenanceResponseSchema
>
