import { describe, expect, it } from 'vitest'

import {
  folderNameRequestSchema,
  monitorMetricsResponseSchema,
  setMonitorFolderRequestSchema,
  updatePreferencesRequestSchema,
} from './workspace.ts'

describe('workspace contracts', () => {
  it('trims folder names and rejects empty or oversized ones', () => {
    expect(folderNameRequestSchema.parse({ name: '  Prod ' })).toEqual({
      name: 'Prod',
    })
    expect(folderNameRequestSchema.safeParse({ name: '   ' }).success).toBe(
      false,
    )
    expect(
      folderNameRequestSchema.safeParse({ name: 'x'.repeat(41) }).success,
    ).toBe(false)
    expect(
      folderNameRequestSchema.safeParse({ name: 'ok', tenantId: 'x' }).success,
    ).toBe(false)
  })

  it('accepts a folder id or null when filing a monitor', () => {
    expect(
      setMonitorFolderRequestSchema.safeParse({ folderId: null }).success,
    ).toBe(true)
    expect(
      setMonitorFolderRequestSchema.safeParse({
        folderId: '20000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true)
    expect(
      setMonitorFolderRequestSchema.safeParse({ folderId: 'x' }).success,
    ).toBe(false)
  })

  it('validates partial preference updates', () => {
    expect(
      updatePreferencesRequestSchema.parse({
        displayName: '  ',
        notifyOnOpen: false,
      }),
    ).toEqual({ displayName: null, notifyOnOpen: false })
    expect(
      updatePreferencesRequestSchema.safeParse({ timezone: 'Europe/Paris' })
        .success,
    ).toBe(true)
    expect(
      updatePreferencesRequestSchema.safeParse({ timezone: 'Mars/Olympus' })
        .success,
    ).toBe(false)
    expect(updatePreferencesRequestSchema.safeParse({}).success).toBe(false)
    expect(
      updatePreferencesRequestSchema.safeParse({ tenantId: 'x' }).success,
    ).toBe(false)
  })

  it('describes daily heartbeat counters without content', () => {
    const parsed = monitorMetricsResponseSchema.safeParse({
      data: {
        days: [
          {
            day: '2026-10-31',
            gapCount: 1,
            gapMaxSeconds: 60,
            gapSumSeconds: 60,
            pings: 2,
          },
        ],
        totalPings: 2,
      },
    })

    expect(parsed.success).toBe(true)
    expect(
      monitorMetricsResponseSchema.safeParse({
        data: { days: [{ day: 'yesterday' }], totalPings: 0 },
      }).success,
    ).toBe(false)
  })
})
