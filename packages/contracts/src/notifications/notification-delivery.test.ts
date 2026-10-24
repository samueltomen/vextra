import { describe, expect, it } from 'vitest'

import {
  listNotificationsResponseSchema,
  notificationDeliverySchema,
} from './notification-delivery.ts'

const DELIVERY = {
  attempts: 1,
  createdAt: '2026-10-24T12:00:00.000Z',
  id: 'a0000000-0000-4000-8000-000000000001',
  kind: 'incident_opened' as const,
  monitorId: '20000000-0000-4000-8000-000000000001',
  status: 'sent' as const,
  updatedAt: '2026-10-24T12:01:00.000Z',
}

describe('notification delivery contracts', () => {
  it('accepts only minimal email delivery metadata', () => {
    expect(notificationDeliverySchema.parse(DELIVERY)).toEqual(DELIVERY)
    expect(
      listNotificationsResponseSchema.parse({
        data: { deliveries: [DELIVERY] },
      }),
    ).toEqual({ data: { deliveries: [DELIVERY] } })
  })

  it('rejects recipient addresses and provider payloads', () => {
    expect(
      notificationDeliverySchema.safeParse({
        ...DELIVERY,
        email: 'owner@example.test',
      }).success,
    ).toBe(false)
    expect(
      notificationDeliverySchema.safeParse({
        ...DELIVERY,
        providerResponse: 'secret',
      }).success,
    ).toBe(false)
  })
})
