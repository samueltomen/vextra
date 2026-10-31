import type {
  ClaimedNotification,
  NotificationDeliveryQueue,
  NotificationKind,
} from '../../application/deliver-notifications.ts'

type ClaimRow = Readonly<{
  attempts: number
  delivery_id: string
  email: string
  kind: NotificationKind
  monitor_id: string
  monitor_name: string | null
}>

type ClaimResult = PromiseLike<
  Readonly<{
    data: ClaimRow[] | null
    error: Readonly<{ message: string }> | null
  }>
>

type CompleteResult = PromiseLike<
  Readonly<{
    data: boolean | null
    error: Readonly<{ message: string }> | null
  }>
>

export type NotificationDeliveryRpcClient = Readonly<{
  rpc(
    functionName: 'claim_notification_deliveries',
    args: Readonly<{ p_batch_size: number }>,
  ): ClaimResult
  rpc(
    functionName: 'complete_notification_delivery',
    args: Readonly<{
      p_delivery_id: string
      p_error_code: string | null
      p_success: boolean
    }>,
  ): CompleteResult
}>

export class SupabaseNotificationDeliveryQueue implements NotificationDeliveryQueue {
  constructor(private readonly client: NotificationDeliveryRpcClient) {}

  async claim(batchSize: number): Promise<readonly ClaimedNotification[]> {
    const { data, error } = await this.client.rpc(
      'claim_notification_deliveries',
      { p_batch_size: batchSize },
    )

    if (error || !data) {
      throw new Error('notification claim failed')
    }

    return data.map((row) => ({
      attempts: row.attempts,
      deliveryId: row.delivery_id,
      email: row.email,
      kind: row.kind,
      monitorId: row.monitor_id,
      monitorName: row.monitor_name,
    }))
  }

  async complete(result: {
    deliveryId: string
    errorCode: string | null
    success: boolean
  }): Promise<void> {
    const { data, error } = await this.client.rpc(
      'complete_notification_delivery',
      {
        p_delivery_id: result.deliveryId,
        p_error_code: result.errorCode,
        p_success: result.success,
      },
    )

    if (error || data !== true) {
      throw new Error('notification completion failed')
    }
  }
}
