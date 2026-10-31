import { describe, expect, it } from 'vitest'

import {
  acceptInvitationRequestSchema,
  changeMemberRoleRequestSchema,
  inviteMemberRequestSchema,
} from './team.ts'

describe('inviteMemberRequestSchema', () => {
  it('lowercases the address and accepts member and viewer', () => {
    expect(
      inviteMemberRequestSchema.parse({
        email: 'Ada@Example.COM',
        role: 'viewer',
      }),
    ).toEqual({ email: 'ada@example.com', role: 'viewer' })
  })

  it('refuses to invite an owner, bad addresses and extra fields', () => {
    expect(
      inviteMemberRequestSchema.safeParse({ email: 'a@b.co', role: 'owner' })
        .success,
    ).toBe(false)
    expect(
      inviteMemberRequestSchema.safeParse({ email: 'nope', role: 'member' })
        .success,
    ).toBe(false)
    expect(
      inviteMemberRequestSchema.safeParse({
        email: 'a@b.co',
        role: 'member',
        tenantId: 'x',
      }).success,
    ).toBe(false)
  })
})

describe('changeMemberRoleRequestSchema', () => {
  it('only allows member and viewer', () => {
    expect(
      changeMemberRoleRequestSchema.safeParse({ role: 'viewer' }).success,
    ).toBe(true)
    expect(
      changeMemberRoleRequestSchema.safeParse({ role: 'owner' }).success,
    ).toBe(false)
  })
})

describe('acceptInvitationRequestSchema', () => {
  it('accepts only well-formed invitation tokens', () => {
    expect(
      acceptInvitationRequestSchema.safeParse({
        token: `vxi_${'A'.repeat(43)}`,
      }).success,
    ).toBe(true)
    expect(
      acceptInvitationRequestSchema.safeParse({ token: 'vxi_short' }).success,
    ).toBe(false)
    expect(
      acceptInvitationRequestSchema.safeParse({ token: `vx_${'A'.repeat(43)}` })
        .success,
    ).toBe(false)
  })
})
