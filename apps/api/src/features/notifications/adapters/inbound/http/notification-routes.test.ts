import { describe, expect, it, vi } from 'vitest'

import type { NotificationHistoryRecord } from '../../../application/notification-history.ts'
import {
  createNotificationRoutes,
  type NotificationRoutesDependencies,
} from './notification-routes.ts'

const DELIVERY: NotificationHistoryRecord = {
  attempts: 1,
  createdAtMs: Date.parse('2026-10-24T12:00:00.000Z'),
  id: 'a0000000-0000-4000-8000-000000000001',
  kind: 'incident_opened',
  monitorId: '20000000-0000-4000-8000-000000000001',
  status: 'sent',
  updatedAtMs: Date.parse('2026-10-24T12:01:00.000Z'),
}

function createApp(
  authenticate: NotificationRoutesDependencies['authenticate'] = async () => ({
    history: { list: vi.fn(async () => [DELIVERY]) },
    tenantId: 'tenant-a',
  }),
) {
  return createNotificationRoutes({ authenticate })
}

describe('GET /api/notifications', () => {
  it('requires an authenticated tenant', async () => {
    const app = createApp(vi.fn(async () => null))
    const response = await app.request('/api/notifications')

    expect(response.status).toBe(401)
  })

  it('returns minimal delivery history', async () => {
    const app = createApp()
    const response = await app.request('/api/notifications')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        deliveries: [
          {
            attempts: 1,
            createdAt: '2026-10-24T12:00:00.000Z',
            id: DELIVERY.id,
            kind: DELIVERY.kind,
            monitorId: DELIVERY.monitorId,
            status: DELIVERY.status,
            updatedAt: '2026-10-24T12:01:00.000Z',
          },
        ],
      },
    })
  })

  it('does not expose persistence failures', async () => {
    const app = createApp(
      vi.fn(async () => ({
        history: {
          list: vi.fn(async () => {
            throw new Error('database unavailable')
          }),
        },
        tenantId: 'tenant-a',
      })),
    )
    const response = await app.request('/api/notifications')

    expect(response.status).toBe(500)
  })
})
