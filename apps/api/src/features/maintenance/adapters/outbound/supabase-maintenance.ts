import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateMaintenanceRequest,
  MaintenanceWindow,
} from '@vextra/contracts'

import {
  MaintenanceLimitError,
  MaintenanceMonitorNotFoundError,
  type MaintenancePort,
} from '../../application/maintenance.ts'

type Row = Readonly<{
  ends_at: string
  id: string
  monitor_id: string | null
  name: string
  starts_at: string
}>

const COLUMNS = 'id, monitor_id, name, starts_at, ends_at'

function toWindow(row: Row): MaintenanceWindow {
  return {
    endsAt: new Date(row.ends_at).toISOString(),
    id: row.id,
    monitorId: row.monitor_id,
    name: row.name,
    startsAt: new Date(row.starts_at).toISOString(),
  }
}

/** Runs under the signed-in user's RLS; the tenant filter is explicit too. */
export class SupabaseMaintenance implements MaintenancePort {
  constructor(private readonly client: SupabaseClient) {}

  async list(tenantId: string): Promise<readonly MaintenanceWindow[]> {
    const { data, error } = await this.client
      .from('maintenance_windows')
      .select(COLUMNS)
      .eq('tenant_id', tenantId)
      .gt('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })

    if (error) {
      throw new Error('maintenance query failed')
    }

    return ((data ?? []) as readonly Row[]).map(toWindow)
  }

  async create(
    tenantId: string,
    input: CreateMaintenanceRequest,
  ): Promise<MaintenanceWindow> {
    const { data, error } = await this.client
      .from('maintenance_windows')
      .insert({
        ends_at: input.endsAt,
        monitor_id: input.monitorId,
        name: input.name,
        starts_at: input.startsAt,
        tenant_id: tenantId,
      })
      .select(COLUMNS)
      .single()

    if (error || !data) {
      if (error?.code === '54000') {
        throw new MaintenanceLimitError()
      }

      if (error?.code === '23503') {
        throw new MaintenanceMonitorNotFoundError()
      }

      throw new Error('maintenance creation failed')
    }

    return toWindow(data as Row)
  }

  async remove(tenantId: string, windowId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('maintenance_windows')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', windowId)
      .select('id')

    if (error) {
      throw new Error('maintenance deletion failed')
    }

    return (data ?? []).length > 0
  }
}
