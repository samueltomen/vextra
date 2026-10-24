import { describe, expect, it } from 'vitest'

import {
  listMonitorsResponseSchema,
  monitorResponseSchema,
} from './monitor-state.ts'

const MONITOR = {
  alertAt: '2026-10-24T12:05:00.000Z',
  createdAt: '2026-10-24T12:00:00.000Z',
  graceSeconds: 30,
  id: '20000000-0000-4000-8000-000000000001',
  incidentOpenedAt: null,
  intervalSeconds: 300,
  lastHeartbeatAt: null,
  pausedAt: null,
  status: 'pending' as const,
}

describe('monitor read contracts', () => {
  it('accepts only the minimal monitor state', () => {
    expect(
      listMonitorsResponseSchema.parse({ data: { monitors: [MONITOR] } }),
    ).toEqual({ data: { monitors: [MONITOR] } })
    expect(monitorResponseSchema.parse({ data: { monitor: MONITOR } })).toEqual(
      { data: { monitor: MONITOR } },
    )
  })

  it('rejects labels, execution content and token material', () => {
    for (const forbidden of [
      { label: 'Backup DB' },
      { command: 'pg_dump production' },
      { heartbeatToken: 'raw-secret' },
      { tenantId: '10000000-0000-4000-8000-000000000001' },
    ]) {
      expect(
        monitorResponseSchema.safeParse({
          data: { monitor: { ...MONITOR, ...forbidden } },
        }).success,
      ).toBe(false)
    }
  })
})
