import { describe, expect, it } from 'vitest'

import {
  buildIntegrationSnippets,
  toCronExpression,
} from './integration-snippets.ts'

const PING_URL = 'https://cronping.example.test/api/ping'

function snippet(token: string | null, id: string, intervalMinutes?: number) {
  const found = buildIntegrationSnippets({
    intervalMinutes,
    pingUrl: PING_URL,
    token,
  }).find((candidate) => candidate.id === id)

  if (!found) {
    throw new Error(`Snippet ${id} introuvable`)
  }

  return found.code
}

describe('buildIntegrationSnippets', () => {
  it('references the environment variable when the token is not revealed', () => {
    expect(snippet(null, 'curl')).toContain(
      'Authorization: Bearer $CRONPING_TOKEN',
    )
    expect(snippet(null, 'python')).toContain('os.environ["CRONPING_TOKEN"]')
    expect(snippet(null, 'node')).toContain('process.env.CRONPING_TOKEN')
    expect(snippet(null, 'powershell')).toContain('$env:CRONPING_TOKEN')
  })

  it('embeds the revealed token in every language except GitHub Actions', () => {
    for (const id of [
      'bash',
      'crontab',
      'curl',
      'node',
      'powershell',
      'python',
    ]) {
      expect(snippet('cp_secret', id)).toContain('cp_secret')
    }

    expect(snippet('cp_secret', 'github')).not.toContain('cp_secret')
    expect(snippet('cp_secret', 'github')).toContain('secrets.CRONPING_TOKEN')
  })

  it('targets the ping endpoint with a POST request everywhere', () => {
    for (const item of buildIntegrationSnippets({
      pingUrl: PING_URL,
      token: null,
    })) {
      expect(item.code).toContain(PING_URL)
      expect(item.code.toUpperCase()).toContain('POST')
    }
  })

  it('only pings from the crontab line when the job succeeds', () => {
    expect(snippet(null, 'crontab', 15)).toContain('*/15 * * * * /chemin')
    expect(snippet(null, 'crontab', 15)).toContain('&& curl')
  })
})

describe('toCronExpression', () => {
  it.each([
    [5, '*/5 * * * *'],
    [60, '0 * * * *'],
    [360, '0 */6 * * *'],
    [1_440, '0 3 * * *'],
    [10_080, '0 3 * * 1'],
    [7, '*/5 * * * *'],
  ])('maps %i minutes to %s', (minutes, expected) => {
    expect(toCronExpression(minutes)).toBe(expected)
  })
})
