import type { SupabaseClient } from '@supabase/supabase-js'

import {
  FolderLimitError,
  FolderNameTakenError,
  FolderNotFoundError,
  type FolderPort,
  type FolderRecord,
  type MonitorDetailsChanges,
  type MonitorDetailsPort,
  type PreferencesPort,
  type PreferencesRecord,
} from '../../application/workspace.ts'

type DbError = Readonly<{ code?: string }> | null

type FolderRow = Readonly<{ id: string; name: string }>

type PreferencesRow = Readonly<{
  default_sort: PreferencesRecord['dashboardSort']
  default_view: PreferencesRecord['dashboardView']
  default_folder_id: string | null
  default_grace_minutes: number
  default_interval_minutes: number
  density: PreferencesRecord['density']
  display_name: string | null
  notify_on_open: boolean
  notify_on_resolve: boolean
  reminder_interval_minutes: PreferencesRecord['reminderIntervalMinutes']
  time_format: PreferencesRecord['timeFormat']
  timezone: string
  weekly_report_enabled: boolean
}>

function throwFolderError(error: NonNullable<DbError>): never {
  if (error.code === '23505') {
    throw new FolderNameTakenError()
  }

  if (error.code === '54000') {
    throw new FolderLimitError()
  }

  if (error.code === '23503') {
    throw new FolderNotFoundError()
  }

  throw new Error('folder query failed')
}

function toFolder(row: FolderRow): FolderRecord {
  return { id: row.id, name: row.name }
}

export class SupabaseFolderRepository implements FolderPort {
  constructor(private readonly client: SupabaseClient) {}

  async list(tenantId: string): Promise<readonly FolderRecord[]> {
    const { data, error } = await this.client
      .from('monitor_folders')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true })

    if (error) {
      throwFolderError(error)
    }

    return ((data ?? []) as readonly FolderRow[]).map(toFolder)
  }

  async create(tenantId: string, name: string): Promise<FolderRecord> {
    const { data, error } = await this.client
      .from('monitor_folders')
      .insert({ name, tenant_id: tenantId })
      .select('id, name')
      .single()

    if (error) {
      throwFolderError(error)
    }

    return toFolder(data as FolderRow)
  }

  async rename(
    tenantId: string,
    folderId: string,
    name: string,
  ): Promise<FolderRecord | null> {
    const { data, error } = await this.client
      .from('monitor_folders')
      .update({ name })
      .eq('tenant_id', tenantId)
      .eq('id', folderId)
      .select('id, name')
      .maybeSingle()

    if (error) {
      throwFolderError(error)
    }

    return data ? toFolder(data as FolderRow) : null
  }

  async remove(tenantId: string, folderId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('monitor_folders')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', folderId)
      .select('id')

    if (error) {
      throwFolderError(error)
    }

    return (data ?? []).length > 0
  }

  async assign(
    tenantId: string,
    monitorId: string,
    folderId: string | null,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from('monitors')
      .update({ folder_id: folderId })
      .eq('tenant_id', tenantId)
      .eq('id', monitorId)
      .select('id')

    if (error) {
      throwFolderError(error)
    }

    return (data ?? []).length > 0
  }
}

function toPreferences(row: PreferencesRow): PreferencesRecord {
  return {
    dashboardSort: row.default_sort,
    dashboardView: row.default_view,
    defaultFolderId: row.default_folder_id,
    defaultGraceMinutes: row.default_grace_minutes,
    defaultIntervalMinutes: row.default_interval_minutes,
    density: row.density,
    displayName: row.display_name,
    notifyOnOpen: row.notify_on_open,
    notifyOnResolve: row.notify_on_resolve,
    reminderIntervalMinutes: row.reminder_interval_minutes,
    timeFormat: row.time_format,
    timezone: row.timezone,
    weeklyReportEnabled: row.weekly_report_enabled,
  }
}

function toColumns(changes: Partial<PreferencesRecord>) {
  return {
    ...(changes.dashboardSort !== undefined
      ? { default_sort: changes.dashboardSort }
      : {}),
    ...(changes.dashboardView !== undefined
      ? { default_view: changes.dashboardView }
      : {}),
    ...(changes.defaultFolderId !== undefined
      ? { default_folder_id: changes.defaultFolderId }
      : {}),
    ...(changes.defaultGraceMinutes !== undefined
      ? { default_grace_minutes: changes.defaultGraceMinutes }
      : {}),
    ...(changes.defaultIntervalMinutes !== undefined
      ? { default_interval_minutes: changes.defaultIntervalMinutes }
      : {}),
    ...(changes.density !== undefined ? { density: changes.density } : {}),
    ...(changes.reminderIntervalMinutes !== undefined
      ? { reminder_interval_minutes: changes.reminderIntervalMinutes }
      : {}),
    ...(changes.weeklyReportEnabled !== undefined
      ? { weekly_report_enabled: changes.weeklyReportEnabled }
      : {}),
    ...(changes.timeFormat !== undefined
      ? { time_format: changes.timeFormat }
      : {}),
    ...(changes.displayName !== undefined
      ? { display_name: changes.displayName }
      : {}),
    ...(changes.notifyOnOpen !== undefined
      ? { notify_on_open: changes.notifyOnOpen }
      : {}),
    ...(changes.notifyOnResolve !== undefined
      ? { notify_on_resolve: changes.notifyOnResolve }
      : {}),
    ...(changes.timezone !== undefined ? { timezone: changes.timezone } : {}),
  }
}

export class SupabasePreferencesRepository implements PreferencesPort {
  constructor(private readonly client: SupabaseClient) {}

  async find(tenantId: string): Promise<PreferencesRecord | null> {
    const { data, error } = await this.client
      .from('account_preferences')
      .select(
        'display_name, timezone, notify_on_open, notify_on_resolve, time_format, density, default_view, default_sort, default_interval_minutes, default_grace_minutes, default_folder_id, reminder_interval_minutes, weekly_report_enabled',
      )
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) {
      throw new Error('preferences query failed')
    }

    return data ? toPreferences(data as PreferencesRow) : null
  }

  async insert(tenantId: string, record: PreferencesRecord): Promise<void> {
    const { error } = await this.client
      .from('account_preferences')
      .insert({ ...toColumns(record), tenant_id: tenantId })

    if (error) {
      throw new Error('preferences insert failed')
    }
  }

  async update(
    tenantId: string,
    changes: Partial<PreferencesRecord>,
  ): Promise<void> {
    const { error } = await this.client
      .from('account_preferences')
      .update(toColumns(changes))
      .eq('tenant_id', tenantId)

    if (error) {
      throw new Error('preferences update failed')
    }
  }
}

export class SupabaseMonitorDetailsRepository implements MonitorDetailsPort {
  constructor(private readonly client: SupabaseClient) {}

  async update(
    tenantId: string,
    monitorId: string,
    changes: MonitorDetailsChanges,
  ): Promise<boolean> {
    const columns = {
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.description !== undefined
        ? { description: changes.description }
        : {}),
      ...(changes.notes !== undefined ? { notes: changes.notes } : {}),
      ...(changes.alertsEnabled !== undefined
        ? { alerts_enabled: changes.alertsEnabled }
        : {}),
    }
    const { data, error } = await this.client
      .from('monitors')
      .update(columns)
      .eq('tenant_id', tenantId)
      .eq('id', monitorId)
      .select('id')

    if (error) {
      throw new Error('monitor details update failed')
    }

    return (data ?? []).length > 0
  }
}
