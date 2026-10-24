import { describe, expect, it } from 'vitest'

import { MAX_GRACE_SECONDS, MAX_INTERVAL_SECONDS } from './create-monitor.ts'
import { updateMonitorScheduleRequestSchema } from './update-monitor.ts'

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
})
