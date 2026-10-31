import { z } from 'zod'

export const MAX_FOLDER_NAME_LENGTH = 40
export const MAX_DISPLAY_NAME_LENGTH = 60

const folderNameSchema = z.string().trim().min(1).max(MAX_FOLDER_NAME_LENGTH)

export const folderSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
})

export const folderNameRequestSchema = z.strictObject({
  name: folderNameSchema,
})

export const listFoldersResponseSchema = z.strictObject({
  data: z.strictObject({ folders: z.array(folderSchema) }),
})

export const folderResponseSchema = z.strictObject({
  data: z.strictObject({ folder: folderSchema }),
})

export const setMonitorFolderRequestSchema = z.strictObject({
  folderId: z.uuid().nullable(),
})

export const timeFormatSchema = z.enum(['12h', '24h'])
export const densitySchema = z.enum(['compact', 'comfortable'])
export const dashboardViewSchema = z.enum(['list', 'grid'])
export const dashboardSortSchema = z.enum([
  'priority',
  'name',
  'signal',
  'recent',
])

export const preferencesSchema = z.strictObject({
  dashboardSort: dashboardSortSchema,
  dashboardView: dashboardViewSchema,
  defaultFolderId: z.uuid().nullable(),
  defaultGraceMinutes: z.number().int().min(0).max(10_080),
  defaultIntervalMinutes: z.number().int().min(1).max(525_600),
  density: densitySchema,
  displayName: z.string().nullable(),
  notifyOnOpen: z.boolean(),
  notifyOnResolve: z.boolean(),
  timeFormat: timeFormatSchema,
  timezone: z.string(),
})

export const updatePreferencesRequestSchema = z
  .strictObject({
    dashboardSort: dashboardSortSchema,
    dashboardView: dashboardViewSchema,
    defaultFolderId: z.uuid().nullable(),
    defaultGraceMinutes: z.number().int().min(0).max(10_080),
    defaultIntervalMinutes: z.number().int().min(1).max(525_600),
    density: densitySchema,
    displayName: z
      .string()
      .trim()
      .max(MAX_DISPLAY_NAME_LENGTH)
      .transform((value) => (value.length === 0 ? null : value))
      .nullable(),
    notifyOnOpen: z.boolean(),
    notifyOnResolve: z.boolean(),
    timeFormat: timeFormatSchema,
    timezone: z
      .string()
      .min(1)
      .max(64)
      .refine(isSupportedTimeZone, 'Unsupported time zone'),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'No change requested')

export const preferencesResponseSchema = z.strictObject({
  data: z.strictObject({ preferences: preferencesSchema }),
})

export const metricsDaySchema = z.strictObject({
  durationCount: z.number().int().nonnegative(),
  durationMaxMs: z.number().int().nonnegative(),
  durationSumMs: z.number().int().nonnegative(),
  fails: z.number().int().nonnegative(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  gapCount: z.number().int().nonnegative(),
  gapMaxSeconds: z.number().int().nonnegative(),
  gapSumSeconds: z.number().int().nonnegative(),
  pings: z.number().int().nonnegative(),
})

export const monitorMetricsResponseSchema = z.strictObject({
  data: z.strictObject({
    days: z.array(metricsDaySchema),
    totalPings: z.number().int().nonnegative(),
  }),
})

export const monitorRunSchema = z.strictObject({
  createdAt: z.iso.datetime(),
  durationMs: z.number().int().nonnegative().nullable(),
  id: z.uuid(),
  kind: z.enum(['success', 'start', 'fail', 'warn']),
  overlapped: z.boolean(),
})

export const monitorRunsResponseSchema = z.strictObject({
  data: z.strictObject({ runs: z.array(monitorRunSchema) }),
})

export const monitorActivityResponseSchema = z.strictObject({
  data: z.strictObject({
    monitors: z.array(
      z.strictObject({
        days: z.array(
          z.strictObject({
            day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
            pings: z.number().int().nonnegative(),
          }),
        ),
        monitorId: z.uuid(),
      }),
    ),
  }),
})

function isSupportedTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: value })

    return true
  } catch {
    return false
  }
}

export type Folder = z.infer<typeof folderSchema>
export type Preferences = z.infer<typeof preferencesSchema>
export type UpdatePreferencesRequest = z.infer<
  typeof updatePreferencesRequestSchema
>
export type MetricsDay = z.infer<typeof metricsDaySchema>
export type MonitorMetricsResponse = z.infer<
  typeof monitorMetricsResponseSchema
>
