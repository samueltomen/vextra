import type {
  NotificationHistoryPort,
  NotificationHistoryRecord,
} from '../../application/notification-history.ts'

const DELIVERY_COLUMNS =
  'id, monitor_id, kind, status, attempts, created_at, updated_at'

type DeliveryRow = Readonly<{
  attempts: number
  created_at: string
  id: string
  kind: 'incident_opened' | 'incident_resolved' | 'run_failed'
  monitor_id: string
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'dead'
  updated_at: string
}>

type DeliveryListResult = PromiseLike<
  Readonly<{
    data: DeliveryRow[] | null
    error: Readonly<{ message: string }> | null
  }>
>

export type NotificationHistoryQueryClient = Readonly<{
  from(table: 'notification_outbox'): Readonly<{
    select(columns: typeof DELIVERY_COLUMNS): Readonly<{
      eq(
        column: 'tenant_id',
        value: string,
      ): Readonly<{
        order(
          column: 'created_at',
          options: Readonly<{ ascending: boolean }>,
        ): Readonly<{
          limit(count: number): DeliveryListResult
        }>
      }>
    }>
  }>
}>

function toRecord(row: DeliveryRow): NotificationHistoryRecord {
  return {
    attempts: row.attempts,
    createdAtMs: Date.parse(row.created_at),
    id: row.id,
    kind: row.kind,
    monitorId: row.monitor_id,
    status: row.status,
    updatedAtMs: Date.parse(row.updated_at),
  }
}

export class SupabaseNotificationHistory implements NotificationHistoryPort {
  constructor(private readonly client: NotificationHistoryQueryClient) {}

  async listByTenant(
    tenantId: string,
  ): Promise<readonly NotificationHistoryRecord[]> {
    const { data, error } = await this.client
      .from('notification_outbox')
      .select(DELIVERY_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error || !data) {
      throw new Error('notification history query failed')
    }

    return data.map(toRecord)
  }
}
