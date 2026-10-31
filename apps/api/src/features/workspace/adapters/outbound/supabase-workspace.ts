import type { SupabaseClient } from '@supabase/supabase-js'

import {
  FolderLimitError,
  FolderNameTakenError,
  FolderNotFoundError,
  type FolderPort,
  type FolderRecord,
  type PreferencesPort,
  type PreferencesRecord,
} from '../../application/workspace.ts'

type DbError = Readonly<{ code?: string }> | null

type FolderRow = Readonly<{ id: string; name: string }>

type PreferencesRow = Readonly<{
  display_name: string | null
  notify_on_open: boolean
  notify_on_resolve: boolean
  timezone: string
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
    displayName: row.display_name,
    notifyOnOpen: row.notify_on_open,
    notifyOnResolve: row.notify_on_resolve,
    timezone: row.timezone,
  }
}

function toColumns(changes: Partial<PreferencesRecord>) {
  return {
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
      .select('display_name, timezone, notify_on_open, notify_on_resolve')
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
