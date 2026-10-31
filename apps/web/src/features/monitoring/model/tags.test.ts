import { describe, expect, it } from 'vitest'

import { collectTags, matchesTag, normalizeTag } from './tags.ts'

describe('normalizeTag', () => {
  it('lowercases, trims and dashes spaces', () => {
    expect(normalizeTag('  Base de Données ')).toBeNull()
    expect(normalizeTag('  Base De Donnees ')).toBe('base-de-donnees')
    expect(normalizeTag('PROD')).toBe('prod')
  })

  it('rejects empty, too long or invalid tags', () => {
    expect(normalizeTag('   ')).toBeNull()
    expect(normalizeTag('a'.repeat(25))).toBeNull()
    expect(normalizeTag('-start')).toBeNull()
    expect(normalizeTag('pay!')).toBeNull()
  })
})

describe('collectTags', () => {
  it('counts tags, most used first', () => {
    expect(
      collectTags([
        { tags: ['prod', 'db'] },
        { tags: ['prod'] },
        { tags: ['api'] },
      ]),
    ).toEqual([
      { count: 2, tag: 'prod' },
      { count: 1, tag: 'api' },
      { count: 1, tag: 'db' },
    ])
  })
})

describe('matchesTag', () => {
  it('matches everything without a selection', () => {
    expect(matchesTag([], null)).toBe(true)
    expect(matchesTag(['prod'], 'prod')).toBe(true)
    expect(matchesTag(['prod'], 'db')).toBe(false)
  })
})
