import { describe, expect, it } from 'vitest'

import {
  publicStatusPageSchema,
  saveStatusPageRequestSchema,
} from './status-page.ts'

const VALID = {
  description: '  État de nos services  ',
  enabled: true,
  monitorIds: ['20000000-0000-4000-8000-000000000001'],
  slug: 'acme-status',
  title: ' Acme ',
}

describe('saveStatusPageRequestSchema', () => {
  it('accepts and trims a valid page', () => {
    expect(saveStatusPageRequestSchema.parse(VALID)).toEqual({
      ...VALID,
      description: 'État de nos services',
      title: 'Acme',
    })
  })

  it('normalizes an empty description to null', () => {
    expect(
      saveStatusPageRequestSchema.parse({ ...VALID, description: '' })
        .description,
    ).toBeNull()
  })

  it.each(['A', 'Bad Slug!', '-start', 'end-', 'x'.repeat(41), 'ab_cd'])(
    'rejects the slug %s',
    (slug) => {
      expect(
        saveStatusPageRequestSchema.safeParse({ ...VALID, slug }).success,
      ).toBe(false)
    },
  )

  it('rejects unknown fields such as a tenant identifier', () => {
    expect(
      saveStatusPageRequestSchema.safeParse({ ...VALID, tenantId: 'x' })
        .success,
    ).toBe(false)
  })

  it('rejects malformed or excessive monitor lists', () => {
    expect(
      saveStatusPageRequestSchema.safeParse({ ...VALID, monitorIds: ['no'] })
        .success,
    ).toBe(false)
    expect(
      saveStatusPageRequestSchema.safeParse({
        ...VALID,
        monitorIds: Array.from(
          { length: 101 },
          (_, i) => `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        ),
      }).success,
    ).toBe(false)
  })
})

describe('publicStatusPageSchema', () => {
  it('parses the public read model', () => {
    expect(
      publicStatusPageSchema.parse({
        description: null,
        generatedAt: '2026-10-31T12:00:00Z',
        incidents: [
          {
            monitor: 'API',
            openedAt: '2026-10-30T10:00:00Z',
            resolvedAt: null,
          },
        ],
        monitors: [{ name: 'API', status: 'healthy', uptime30d: 99.9 }],
        title: 'Acme',
      }).monitors,
    ).toHaveLength(1)
  })
})
