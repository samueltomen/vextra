import { z } from 'zod'

export const rotateMonitorTokenResponseSchema = z.strictObject({
  data: z.strictObject({
    heartbeatToken: z.string().min(1),
  }),
})

export type RotateMonitorTokenResponse = z.infer<
  typeof rotateMonitorTokenResponseSchema
>
