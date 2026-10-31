const MAX_BATCH_SIZE = 50

export type NotificationKind = 'incident_opened' | 'incident_resolved'

export type ClaimedNotification = Readonly<{
  attempts: number
  deliveryId: string
  email: string
  kind: NotificationKind
  monitorId: string
  monitorName: string | null
}>

export interface NotificationDeliveryQueue {
  claim(batchSize: number): Promise<readonly ClaimedNotification[]>
  complete(result: {
    deliveryId: string
    errorCode: string | null
    success: boolean
  }): Promise<void>
}

export interface NotificationSender {
  send(input: {
    kind: NotificationKind
    monitorId: string
    monitorName: string | null
    to: string
  }): Promise<void>
}

export class DeliverNotifications {
  constructor(
    private readonly dependencies: Readonly<{
      queue: NotificationDeliveryQueue
      sender: NotificationSender
    }>,
  ) {}

  async execute(batchSize = 10): Promise<{
    failed: number
    sent: number
  }> {
    if (
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > MAX_BATCH_SIZE
    ) {
      throw new RangeError(
        `batch size must be an integer between 1 and ${MAX_BATCH_SIZE}`,
      )
    }

    const notifications = await this.dependencies.queue.claim(batchSize)
    let failed = 0
    let sent = 0

    for (const notification of notifications) {
      try {
        await this.dependencies.sender.send({
          kind: notification.kind,
          monitorId: notification.monitorId,
          monitorName: notification.monitorName,
          to: notification.email,
        })
        await this.dependencies.queue.complete({
          deliveryId: notification.deliveryId,
          errorCode: null,
          success: true,
        })
        sent += 1
      } catch {
        await this.dependencies.queue.complete({
          deliveryId: notification.deliveryId,
          errorCode: 'email_delivery_failed',
          success: false,
        })
        failed += 1
      }
    }

    return { failed, sent }
  }
}
