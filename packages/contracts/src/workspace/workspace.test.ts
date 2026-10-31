import { describe, expect, it } from 'vitest'

import {
  folderNameRequestSchema,
  monitorActivityResponseSchema,
  monitorMetricsResponseSchema,
  monitorRunsResponseSchema,
  setMonitorFolderRequestSchema,
  updatePreferencesRequestSchema,
} from './workspace.ts'

describe('workspace contracts', () => {
  it('describes the run history without output or payload', () => {
    expect(
      monitorRunsResponseSchema.safeParse({
        data: {
          runs: [
            {
              createdAt: '2026-10-31T12:00:00.000Z',
              durationMs: 1200,
              id: '20000000-0000-4000-8000-000000000001',
              kind: 'success',
              overlapped: false,
            },
          ],
        },
      }).success,
    ).toBe(true)
    expect(
      monitorRunsResponseSchema.safeParse({
        data: {
          runs: [
            {
              createdAt: '2026-10-31T12:00:00.000Z',
              durationMs: null,
              id: '20000000-0000-4000-8000-000000000001',
              kind: 'crash',
              output: 'secret',
              overlapped: false,
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  it('describes per-monitor daily activity', () => {
    expect(
      monitorActivityResponseSchema.safeParse({
        data: {
          monitors: [
            {
              days: [{ day: '2026-10-31', pings: 3 }],
              monitorId: '20000000-0000-4000-8000-000000000001',
            },
          ],
        },
      }).success,
    ).toBe(true)
    expect(
      monitorActivityResponseSchema.safeParse({
        data: { monitors: [{ days: [], monitorId: 'x' }] },
      }).success,
    ).toBe(false)
  })

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
            durationCount: 1,
            durationMaxMs: 1200,
            durationSumMs: 1200,
            fails: 0,
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
