import { describe, expect, it, vi } from 'vitest'

import {
  SupabaseNotificationHistory,
  type NotificationHistoryQueryClient,
} from './supabase-notification-history.ts'

describe('SupabaseNotificationHistory', () => {
  it('queries a bounded tenant-scoped delivery history', async () => {
    const limit = vi.fn(async () => ({
      data: [
        {
          attempts: 2,
          created_at: '2026-10-24T12:00:00.000Z',
          id: 'a0000000-0000-4000-8000-000000000001',
          kind: 'incident_opened',
          monitor_id: '20000000-0000-4000-8000-000000000001',
          status: 'sent',
          updated_at: '2026-10-24T12:01:00.000Z',
        },
      ],
      error: null,
    }))
    const order = vi.fn(() => ({ limit }))
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))
    const repository = new SupabaseNotificationHistory({
      from: () => ({ select }),
    } as unknown as NotificationHistoryQueryClient)

    await expect(repository.listByTenant('tenant-a')).resolves.toHaveLength(1)
    expect(eq).toHaveBeenCalledWith('tenant_id', 'tenant-a')
    expect(limit).toHaveBeenCalledWith(50)
  })

  it('rejects query failures without leaking provider details', async () => {
    const repository = new SupabaseNotificationHistory({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: null,
                error: { message: 'database unavailable' },
              }),
            }),
          }),
        }),
      }),
    } as unknown as NotificationHistoryQueryClient)

    await expect(repository.listByTenant('tenant-a')).rejects.toThrow(
      'notification history query failed',
    )
  })
})
