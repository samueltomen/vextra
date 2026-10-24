import { describe, expect, it, vi } from 'vitest'

import {
  NotificationHistory,
  type NotificationHistoryRecord,
  type NotificationHistoryPort,
} from './notification-history.ts'

const DELIVERY: NotificationHistoryRecord = {
  attempts: 1,
  createdAtMs: Date.parse('2026-10-24T12:00:00.000Z'),
  id: 'a0000000-0000-4000-8000-000000000001',
  kind: 'incident_opened',
  monitorId: '20000000-0000-4000-8000-000000000001',
  status: 'sent',
  updatedAtMs: Date.parse('2026-10-24T12:01:00.000Z'),
}

describe('NotificationHistory', () => {
  it('lists notification deliveries for one tenant', async () => {
    const port: NotificationHistoryPort = {
      listByTenant: vi.fn(async () => [DELIVERY]),
    }
    const history = new NotificationHistory(port)

    await expect(history.list('tenant-a')).resolves.toEqual([DELIVERY])
    expect(port.listByTenant).toHaveBeenCalledWith('tenant-a')
  })
})
