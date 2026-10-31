import { describe, expect, it } from 'vitest'

import {
  authenticatedSessionResponseSchema,
  signInRequestSchema,
  signUpRequestSchema,
  signUpResponseSchema,
  switchTenantRequestSchema,
} from './auth.ts'

describe('account contracts', () => {
  it('validates a space switch request', () => {
    expect(
      switchTenantRequestSchema.safeParse({
        tenantId: '10000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true)
    expect(
      switchTenantRequestSchema.safeParse({ tenantId: 'nope' }).success,
    ).toBe(false)
  })

  it('normalizes sign-up email addresses and requires a strong password', () => {
    expect(
      signUpRequestSchema.parse({
        email: '  Alice@Example.TEST ',
        password: 'correct horse battery staple',
      }),
    ).toEqual({
      email: 'alice@example.test',
      password: 'correct horse battery staple',
    })

    expect(
      signUpRequestSchema.safeParse({
        email: 'alice@example.test',
        password: 'too-short',
      }).success,
    ).toBe(false)
  })

  it('rejects unknown credential fields', () => {
    expect(
      signInRequestSchema.safeParse({
        email: 'alice@example.test',
        password: 'password',
        tenantId: 'client-controlled',
      }).success,
    ).toBe(false)
  })

  it('exposes no session token in response contracts', () => {
    const userId = '00000000-0000-4000-8000-000000000001'
    const tenantId = '10000000-0000-4000-8000-000000000001'
    const user = { email: 'alice@example.test', id: userId }

    expect(
      signUpResponseSchema.parse({
        data: { requiresEmailConfirmation: false, user },
      }),
    ).toEqual({
      data: { requiresEmailConfirmation: false, user },
    })
    expect(
      authenticatedSessionResponseSchema.parse({
        data: { role: 'owner', tenantId, user },
      }),
    ).toEqual({
      data: { role: 'owner', tenantId, user },
    })
    expect(
      authenticatedSessionResponseSchema.safeParse({
        data: { accessToken: 'secret', role: 'owner', tenantId, user },
      }).success,
    ).toBe(false)
  })
})
