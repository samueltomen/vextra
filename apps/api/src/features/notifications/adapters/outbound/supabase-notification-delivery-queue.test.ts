import { describe, expect, it, vi } from 'vitest'

import {
  SupabaseNotificationDeliveryQueue,
  type NotificationDeliveryRpcClient,
} from './supabase-notification-delivery-queue.ts'

describe('SupabaseNotificationDeliveryQueue', () => {
  it('claims minimal delivery data and completes delivery status', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            attempts: 1,
            delivery_id: 'a0000000-0000-4000-8000-000000000001',
            email: 'owner@example.test',
            kind: 'incident_opened',
            monitor_id: '20000000-0000-4000-8000-000000000001',
            monitor_name: 'Sauvegarde nocturne',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: true, error: null })
    const queue = new SupabaseNotificationDeliveryQueue({
      rpc,
    } as unknown as NotificationDeliveryRpcClient)

    await expect(queue.claim(10)).resolves.toEqual([
      {
        attempts: 1,
        deliveryId: 'a0000000-0000-4000-8000-000000000001',
        email: 'owner@example.test',
        kind: 'incident_opened',
        monitorId: '20000000-0000-4000-8000-000000000001',
        monitorName: 'Sauvegarde nocturne',
      },
    ])
    await queue.complete({
      deliveryId: 'a0000000-0000-4000-8000-000000000001',
      errorCode: null,
      success: true,
    })
    expect(rpc).toHaveBeenLastCalledWith('complete_notification_delivery', {
      p_delivery_id: 'a0000000-0000-4000-8000-000000000001',
      p_error_code: null,
      p_success: true,
    })
  })

  it('translates claim and completion provider failures', async () => {
    const failedClaim = new SupabaseNotificationDeliveryQueue({
      rpc: async () => ({ data: null, error: { message: 'denied' } }),
    } as unknown as NotificationDeliveryRpcClient)
    await expect(failedClaim.claim(10)).rejects.toThrow(
      'notification claim failed',
    )

    const failedCompletion = new SupabaseNotificationDeliveryQueue({
      rpc: async () => ({ data: false, error: null }),
    } as unknown as NotificationDeliveryRpcClient)
    await expect(
      failedCompletion.complete({
        deliveryId: 'a0000000-0000-4000-8000-000000000001',
        errorCode: 'email_delivery_failed',
        success: false,
      }),
    ).rejects.toThrow('notification completion failed')
  })
})
