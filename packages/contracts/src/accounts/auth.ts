import { z } from 'zod'

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254))

const signUpPasswordSchema = z.string().min(12).max(72)

const signInPasswordSchema = z.string().min(1).max(72)

export const signUpRequestSchema = z.strictObject({
  email: emailSchema,
  password: signUpPasswordSchema,
})

export const signInRequestSchema = z.strictObject({
  email: emailSchema,
  password: signInPasswordSchema,
})

export const authUserSchema = z.strictObject({
  id: z.uuid(),
  email: z.email(),
})

export const signUpResponseSchema = z.strictObject({
  data: z.strictObject({
    requiresEmailConfirmation: z.boolean(),
    user: authUserSchema,
  }),
})

export const membershipRoleSchema = z.enum(['owner', 'member', 'viewer'])

export const switchTenantRequestSchema = z.strictObject({
  tenantId: z.uuid(),
})

export const authenticatedSessionResponseSchema = z.strictObject({
  data: z.strictObject({
    role: membershipRoleSchema,
    tenantId: z.uuid(),
    user: authUserSchema,
  }),
})

export type SignUpRequest = z.infer<typeof signUpRequestSchema>
export type SignInRequest = z.infer<typeof signInRequestSchema>

export type AuthUser = z.infer<typeof authUserSchema>
export type SignUpResponse = z.infer<typeof signUpResponseSchema>
export type AuthenticatedSessionResponse = z.infer<
  typeof authenticatedSessionResponseSchema
>
