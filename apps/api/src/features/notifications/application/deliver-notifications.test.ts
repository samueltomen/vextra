import { describe, expect, it, vi } from 'vitest'

import {
  DeliverNotifications,
  type NotificationDeliveryQueue,
  type NotificationSender,
} from './deliver-notifications.ts'

const DELIVERY = {
  attempts: 1,
  deliveryId: 'a0000000-0000-4000-8000-000000000001',
  email: 'owner@example.test',
  kind: 'incident_opened' as const,
  monitorId: '20000000-0000-4000-8000-000000000001',
  monitorName: 'Sauvegarde nocturne',
}

function createQueue(
  overrides: Partial<NotificationDeliveryQueue> = {},
): NotificationDeliveryQueue {
  return {
    claim: vi.fn(async () => [DELIVERY]),
    complete: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('DeliverNotifications', () => {
  it('sends claimed notifications and records success', async () => {
    const queue = createQueue()
    const sender: NotificationSender = {
      send: vi.fn(async () => undefined),
    }
    const deliver = new DeliverNotifications({ queue, sender })

    await expect(deliver.execute()).resolves.toEqual({
      failed: 0,
      sent: 1,
    })
    expect(sender.send).toHaveBeenCalledWith({
      kind: 'incident_opened',
      monitorId: DELIVERY.monitorId,
      monitorName: DELIVERY.monitorName,
      to: DELIVERY.email,
    })
    expect(queue.complete).toHaveBeenCalledWith({
      deliveryId: DELIVERY.deliveryId,
      errorCode: null,
      success: true,
    })
  })

  it('records a normalized failure and continues with the batch', async () => {
    const second = {
      ...DELIVERY,
      deliveryId: 'a0000000-0000-4000-8000-000000000002',
    }
    const queue = createQueue({ claim: vi.fn(async () => [DELIVERY, second]) })
    const sender: NotificationSender = {
      send: vi
        .fn()
        .mockRejectedValueOnce(
          new Error('provider included owner@example.test'),
        )
        .mockResolvedValueOnce(undefined),
    }
    const deliver = new DeliverNotifications({ queue, sender })

    await expect(deliver.execute(2)).resolves.toEqual({
      failed: 1,
      sent: 1,
    })
    expect(queue.complete).toHaveBeenNthCalledWith(1, {
      deliveryId: DELIVERY.deliveryId,
      errorCode: 'email_delivery_failed',
      success: false,
    })
    expect(queue.complete).toHaveBeenNthCalledWith(2, {
      deliveryId: second.deliveryId,
      errorCode: null,
      success: true,
    })
  })

  it.each([0, -1, 1.5, 51])(
    'rejects an unsafe delivery batch size: %s',
    async (batchSize) => {
      const queue = createQueue()
      const deliver = new DeliverNotifications({
        queue,
        sender: { send: vi.fn() },
      })

      await expect(deliver.execute(batchSize)).rejects.toBeInstanceOf(
        RangeError,
      )
      expect(queue.claim).not.toHaveBeenCalled()
    },
  )
})
