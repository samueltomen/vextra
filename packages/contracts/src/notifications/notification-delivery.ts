import { z } from 'zod'

export const notificationDeliveryKindSchema = z.enum([
  'incident_opened',
  'incident_resolved',
])

export const notificationDeliveryStatusSchema = z.enum([
  'pending',
  'processing',
  'sent',
  'failed',
  'dead',
  'skipped',
])

export const notificationDeliverySchema = z.strictObject({
  attempts: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  kind: notificationDeliveryKindSchema,
  monitorId: z.uuid(),
  status: notificationDeliveryStatusSchema,
  updatedAt: z.iso.datetime(),
})

export const listNotificationsResponseSchema = z.strictObject({
  data: z.strictObject({
    deliveries: z.array(notificationDeliverySchema),
  }),
})

export type NotificationDelivery = z.infer<typeof notificationDeliverySchema>
export type ListNotificationsResponse = z.infer<
  typeof listNotificationsResponseSchema
>
