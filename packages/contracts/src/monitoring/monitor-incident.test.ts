import { describe, expect, it } from 'vitest'

import {
  listMonitorIncidentsResponseSchema,
  monitorIncidentSchema,
} from './monitor-incident.ts'

const INCIDENT = {
  id: '60000000-0000-4000-8000-000000000001',
  monitorId: '20000000-0000-4000-8000-000000000001',
  openedAt: '2026-10-24T12:00:00.000Z',
  reason: 'heartbeat_missed' as const,
  resolutionReason: null,
  resolvedAt: null,
}

describe('monitor incident contracts', () => {
  it('accepts only the minimal incident lifecycle', () => {
    expect(monitorIncidentSchema.parse(INCIDENT)).toEqual(INCIDENT)
    expect(
      listMonitorIncidentsResponseSchema.parse({
        data: { incidents: [INCIDENT] },
      }),
    ).toEqual({ data: { incidents: [INCIDENT] } })
  })

  it('rejects execution content and arbitrary reasons', () => {
    expect(
      monitorIncidentSchema.safeParse({
        ...INCIDENT,
        output: 'secret stdout',
      }).success,
    ).toBe(false)
    expect(
      monitorIncidentSchema.safeParse({
        ...INCIDENT,
        reason: 'server_name',
      }).success,
    ).toBe(false)
  })
})
