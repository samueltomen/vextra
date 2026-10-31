import { z } from 'zod'

import { membershipRoleSchema } from '../accounts/auth.ts'

export const invitableRoleSchema = z.enum(['member', 'viewer'])

export const inviteMemberRequestSchema = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  role: invitableRoleSchema,
})

export const changeMemberRoleRequestSchema = z.strictObject({
  role: invitableRoleSchema,
})

export const INVITATION_TOKEN_PATTERN = /^vxi_[A-Za-z0-9_-]{43}$/

export const acceptInvitationRequestSchema = z.strictObject({
  token: z.string().regex(INVITATION_TOKEN_PATTERN),
})

export const teamMemberSchema = z.object({
  email: z.string(),
  joinedAt: z.string(),
  role: membershipRoleSchema,
  userId: z.string(),
})

export const invitationSchema = z.object({
  createdAt: z.string(),
  email: z.string(),
  expiresAt: z.string(),
  id: z.string(),
  role: invitableRoleSchema,
})

export const spaceSchema = z.object({
  ownerEmail: z.string().nullable(),
  role: membershipRoleSchema,
  tenantId: z.string(),
})

export type InviteMemberRequest = z.infer<typeof inviteMemberRequestSchema>
export type TeamMember = z.infer<typeof teamMemberSchema>
export type Invitation = z.infer<typeof invitationSchema>
export type Space = z.infer<typeof spaceSchema>
