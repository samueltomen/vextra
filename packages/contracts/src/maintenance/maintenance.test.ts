import { describe, expect, it } from 'vitest'

import { createMaintenanceRequestSchema } from './maintenance.ts'

const VALID = {
  endsAt: '2026-11-02T04:00:00.000Z',
  monitorId: null,
  name: ' Migration base ',
  startsAt: '2026-11-02T02:00:00.000Z',
}

describe('createMaintenanceRequestSchema', () => {
  it('accepts a window for all monitors or for one', () => {
    expect(createMaintenanceRequestSchema.parse(VALID).name).toBe(
      'Migration base',
    )
    expect(
      createMaintenanceRequestSchema.safeParse({
        ...VALID,
        monitorId: '20000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true)
  })

  it('rejects inverted, empty or overlong windows', () => {
    expect(
      createMaintenanceRequestSchema.safeParse({
        ...VALID,
        endsAt: VALID.startsAt,
      }).success,
    ).toBe(false)
    expect(
      createMaintenanceRequestSchema.safeParse({
        ...VALID,
        endsAt: '2026-12-31T00:00:00.000Z',
      }).success,
    ).toBe(false)
    expect(
      createMaintenanceRequestSchema.safeParse({ ...VALID, name: ' ' }).success,
    ).toBe(false)
  })

  it('rejects unknown fields such as a tenant identifier', () => {
    expect(
      createMaintenanceRequestSchema.safeParse({ ...VALID, tenantId: 'x' })
        .success,
    ).toBe(false)
  })
})
