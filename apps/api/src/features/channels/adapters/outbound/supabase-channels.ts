import type { SupabaseClient } from '@supabase/supabase-js'

import {
  ChannelLimitError,
  ChannelNameTakenError,
  type ChannelDeliveryQueue,
  type ChannelKind,
  type ChannelPort,
  type ChannelRecord,
  type ChannelSecretPort,
  type ClaimedChannelDelivery,
  type IncidentReminderPort,
} from '../../application/channels.ts'

type DbError = Readonly<{ code?: string }>

type ChannelRow = Readonly<{
  created_at: string
  enabled: boolean
  id: string
  kind: ChannelKind
  name: string
  target_hint: string
}>

const CHANNEL_COLUMNS = 'id, kind, name, target_hint, enabled, created_at'

function throwChannelError(error: DbError): never {
  if (error.code === '23505') {
    throw new ChannelNameTakenError()
  }

  if (error.code === '54000') {
    throw new ChannelLimitError()
  }

  throw new Error('channel query failed')
}

function toRecord(row: ChannelRow): ChannelRecord {
  return {
    createdAtMs: Date.parse(row.created_at),
    enabled: row.enabled,
    id: row.id,
    kind: row.kind,
    name: row.name,
    targetHint: row.target_hint,
  }
}

/** Uses the user's client: row level security scopes every query. */
export class SupabaseChannelRepository implements ChannelPort {
  constructor(private readonly client: SupabaseClient) {}

  async list(tenantId: string): Promise<readonly ChannelRecord[]> {
    const { data, error } = await this.client
      .from('notification_channels')
      .select(CHANNEL_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })

    if (error) {
      throwChannelError(error)
    }

    return ((data ?? []) as readonly ChannelRow[]).map(toRecord)
  }

  async create(
    tenantId: string,
    input: Readonly<{
      kind: ChannelKind
      name: string
      target: string
      targetHint: string
    }>,
  ): Promise<ChannelRecord> {
    const { data, error } = await this.client
      .from('notification_channels')
      .insert({
        kind: input.kind,
        name: input.name,
        target: input.target,
        target_hint: input.targetHint,
        tenant_id: tenantId,
      })
      .select(CHANNEL_COLUMNS)
      .single()

    if (error) {
      throwChannelError(error)
    }

    return toRecord(data as ChannelRow)
  }

  async setEnabled(
    tenantId: string,
    channelId: string,
    enabled: boolean,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from('notification_channels')
      .update({ enabled })
      .eq('tenant_id', tenantId)
      .eq('id', channelId)
      .select('id')

    if (error) {
      throwChannelError(error)
    }

    return (data ?? []).length > 0
  }

  async remove(tenantId: string, channelId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('notification_channels')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', channelId)
      .select('id')

    if (error) {
      throwChannelError(error)
    }

    return (data ?? []).length > 0
  }
}

/**
 * Reads the secret target with the service role, which bypasses row level
 * security: the tenant filter below is therefore mandatory.
 */
export class SupabaseChannelSecrets implements ChannelSecretPort {
  constructor(private readonly serviceClient: SupabaseClient) {}

  async findTarget(
    tenantId: string,
    channelId: string,
  ): Promise<Readonly<{ kind: ChannelKind; target: string }> | null> {
    const { data, error } = await this.serviceClient
      .from('notification_channels')
      .select('kind, target')
      .eq('tenant_id', tenantId)
      .eq('id', channelId)
      .maybeSingle()

    if (error) {
      throw new Error('channel secret query failed')
    }

    return data
      ? {
          kind: (data as { kind: ChannelKind }).kind,
          target: (data as { target: string }).target,
        }
      : null
  }
}

type ClaimRow = Readonly<{
  attempts: number
  channel_kind: ChannelKind
  channel_name: string
  delivery_id: string
  kind: ClaimedChannelDelivery['event']
  monitor_id: string
  monitor_name: string | null
  opened_at: string | null
  target: string
}>

export class SupabaseChannelDeliveryQueue implements ChannelDeliveryQueue {
  constructor(private readonly serviceClient: SupabaseClient) {}

  async claim(batchSize: number): Promise<readonly ClaimedChannelDelivery[]> {
    const { data, error } = await this.serviceClient.rpc(
      'claim_channel_deliveries',
      { p_batch_size: batchSize },
    )

    if (error || !data) {
      throw new Error('channel claim failed')
    }

    return (data as readonly ClaimRow[]).map((row) => ({
      attempts: row.attempts,
      channelKind: row.channel_kind,
      channelName: row.channel_name,
      deliveryId: row.delivery_id,
      event: row.kind,
      monitorId: row.monitor_id,
      monitorName: row.monitor_name,
      openedAtMs: row.opened_at === null ? null : Date.parse(row.opened_at),
      target: row.target,
    }))
  }

  async complete(
    result: Readonly<{
      deliveryId: string
      errorCode: string | null
      success: boolean
    }>,
  ): Promise<void> {
    const { data, error } = await this.serviceClient.rpc(
      'complete_channel_delivery',
      {
        p_delivery_id: result.deliveryId,
        p_error_code: result.errorCode,
        p_success: result.success,
      },
    )

    if (error || data !== true) {
      throw new Error('channel completion failed')
    }
  }
}

export class SupabaseIncidentReminders implements IncidentReminderPort {
  constructor(private readonly serviceClient: SupabaseClient) {}

  async enqueue(): Promise<number> {
    const { data, error } = await this.serviceClient.rpc(
      'enqueue_incident_reminders',
    )

    if (error || typeof data !== 'number') {
      throw new Error('reminder enqueue failed')
    }

    return data
  }
}
