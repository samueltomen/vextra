import { describe, expect, it } from 'vitest'

import { createApiKeyRequestSchema } from './api-key.ts'

describe('createApiKeyRequestSchema', () => {
  it('trims the name', () => {
    expect(createApiKeyRequestSchema.parse({ name: ' CI ' }).name).toBe('CI')
  })

  it('rejects empty, long names and extra fields', () => {
    expect(createApiKeyRequestSchema.safeParse({ name: ' ' }).success).toBe(
      false,
    )
    expect(
      createApiKeyRequestSchema.safeParse({ name: 'x'.repeat(61) }).success,
    ).toBe(false)
    expect(
      createApiKeyRequestSchema.safeParse({ name: 'CI', tenantId: 'x' })
        .success,
    ).toBe(false)
  })
})
