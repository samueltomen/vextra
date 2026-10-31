import { describe, expect, it } from 'vitest'

import { MAX_GRACE_SECONDS, MAX_INTERVAL_SECONDS } from './create-monitor.ts'
import {
  updateMonitorDetailsRequestSchema,
  updateMonitorScheduleRequestSchema,
} from './update-monitor.ts'

describe('updateMonitorScheduleRequestSchema', () => {
  it('accepts the boundaries of a valid schedule', () => {
    expect(
      updateMonitorScheduleRequestSchema.safeParse({
        graceSeconds: 0,
        intervalSeconds: 60,
      }).success,
    ).toBe(true)
    expect(
      updateMonitorScheduleRequestSchema.safeParse({
        graceSeconds: MAX_GRACE_SECONDS,
        intervalSeconds: MAX_INTERVAL_SECONDS,
      }).success,
    ).toBe(true)
  })

  it.each([
    { graceSeconds: 0, intervalSeconds: 59 },
    { graceSeconds: -1, intervalSeconds: 60 },
    { graceSeconds: MAX_GRACE_SECONDS + 1, intervalSeconds: 60 },
    { graceSeconds: 0, intervalSeconds: MAX_INTERVAL_SECONDS + 1 },
    { graceSeconds: 1.5, intervalSeconds: 60 },
    { graceSeconds: 0 },
  ])('rejects the invalid schedule %j', (payload) => {
    expect(updateMonitorScheduleRequestSchema.safeParse(payload).success).toBe(
      false,
    )
  })

  it('rejects fields that the client must not control', () => {
    expect(
      updateMonitorScheduleRequestSchema.safeParse({
        graceSeconds: 0,
        intervalSeconds: 60,
        tenantId: 'tenant-b',
      }).success,
    ).toBe(false)
  })

  it('validates partial monitor detail updates', () => {
    expect(
      updateMonitorDetailsRequestSchema.parse({
        alertsEnabled: false,
        description: '  ',
        name: ' Sync ',
      }),
    ).toEqual({ alertsEnabled: false, description: null, name: 'Sync' })
    expect(updateMonitorDetailsRequestSchema.safeParse({}).success).toBe(false)
    expect(
      updateMonitorDetailsRequestSchema.safeParse({ name: 'x'.repeat(81) })
        .success,
    ).toBe(false)
    expect(
      updateMonitorDetailsRequestSchema.safeParse({ notes: 'x'.repeat(2001) })
        .success,
    ).toBe(false)
    expect(
      updateMonitorDetailsRequestSchema.safeParse({ tenantId: 'x' }).success,
    ).toBe(false)
  })
})

describe('monitor tags', () => {
  it('normalizes, deduplicates and accepts valid tags', async () => {
    const { updateMonitorDetailsRequestSchema } =
      await import('./update-monitor.ts')

    expect(
      updateMonitorDetailsRequestSchema.parse({
        tags: [' Prod ', 'db-backup', 'prod'],
      }).tags,
    ).toEqual(['prod', 'db-backup'])
  })

  it.each([['bad tag'], ['-x'], ['a'.repeat(25)], ['é']])(
    'rejects the tag %s',
    async (tag) => {
      const { updateMonitorDetailsRequestSchema } =
        await import('./update-monitor.ts')

      expect(
        updateMonitorDetailsRequestSchema.safeParse({ tags: [tag] }).success,
      ).toBe(false)
    },
  )

  it('rejects more than ten tags', async () => {
    const { updateMonitorDetailsRequestSchema } =
      await import('./update-monitor.ts')

    expect(
      updateMonitorDetailsRequestSchema.safeParse({
        tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
      }).success,
    ).toBe(false)
  })
})
