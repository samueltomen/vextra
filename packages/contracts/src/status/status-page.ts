import { z } from 'zod'

import { monitorIdSchema } from '../monitoring/monitor-state.ts'

export const MAX_STATUS_PAGE_MONITORS = 100

export const statusPageSlugSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/,
    'Use 3 to 40 lowercase letters, digits or dashes',
  )

export const saveStatusPageRequestSchema = z.strictObject({
  description: z
    .string()
    .trim()
    .max(280)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable(),
  enabled: z.boolean(),
  monitorIds: z.array(monitorIdSchema).max(MAX_STATUS_PAGE_MONITORS),
  slug: statusPageSlugSchema,
  title: z.string().trim().min(1).max(80),
})

export type SaveStatusPageRequest = z.infer<typeof saveStatusPageRequestSchema>

export const statusPageResponseSchema = z.object({
  data: z.object({
    page: z
      .object({
        description: z.string().nullable(),
        enabled: z.boolean(),
        slug: z.string(),
        title: z.string(),
      })
      .nullable(),
    monitorIds: z.array(z.string()),
  }),
})

export type StatusPageResponse = z.infer<typeof statusPageResponseSchema>

export const publicStatusPageSchema = z.object({
  description: z.string().nullable(),
  generatedAt: z.string(),
  incidents: z.array(
    z.object({
      monitor: z.string(),
      openedAt: z.string(),
      resolvedAt: z.string().nullable(),
    }),
  ),
  monitors: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['healthy', 'late', 'paused', 'pending']),
      uptime30d: z.number(),
    }),
  ),
  title: z.string(),
})

export type PublicStatusPage = z.infer<typeof publicStatusPageSchema>
export type PublicStatusPageResponse = Readonly<{ data: PublicStatusPage }>
