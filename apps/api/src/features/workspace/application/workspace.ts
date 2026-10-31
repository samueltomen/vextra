export class FolderNameTakenError extends Error {
  constructor() {
    super('folder name already used')
    this.name = 'FolderNameTakenError'
  }
}

export class FolderLimitError extends Error {
  constructor() {
    super('folder limit reached')
    this.name = 'FolderLimitError'
  }
}

export class FolderNotFoundError extends Error {
  constructor() {
    super('folder not found')
    this.name = 'FolderNotFoundError'
  }
}

export type FolderRecord = Readonly<{ id: string; name: string }>

export interface FolderPort {
  assign(
    tenantId: string,
    monitorId: string,
    folderId: string | null,
  ): Promise<boolean>
  create(tenantId: string, name: string): Promise<FolderRecord>
  list(tenantId: string): Promise<readonly FolderRecord[]>
  remove(tenantId: string, folderId: string): Promise<boolean>
  rename(
    tenantId: string,
    folderId: string,
    name: string,
  ): Promise<FolderRecord | null>
}

export class ManageFolders {
  constructor(private readonly port: FolderPort) {}

  assign(tenantId: string, monitorId: string, folderId: string | null) {
    return this.port.assign(tenantId, monitorId, folderId)
  }

  create(tenantId: string, name: string) {
    return this.port.create(tenantId, name)
  }

  list(tenantId: string) {
    return this.port.list(tenantId)
  }

  remove(tenantId: string, folderId: string) {
    return this.port.remove(tenantId, folderId)
  }

  rename(tenantId: string, folderId: string, name: string) {
    return this.port.rename(tenantId, folderId, name)
  }
}

export type PreferencesRecord = Readonly<{
  dashboardSort: 'name' | 'priority' | 'recent' | 'signal'
  dashboardView: 'grid' | 'list'
  defaultFolderId: string | null
  defaultGraceMinutes: number
  defaultIntervalMinutes: number
  density: 'comfortable' | 'compact'
  displayName: string | null
  notifyOnOpen: boolean
  notifyOnResolve: boolean
  reminderIntervalMinutes: 60 | 360 | 1440 | 10080 | null
  timeFormat: '12h' | '24h'
  timezone: string
  weeklyReportEnabled: boolean
}>

export const DEFAULT_PREFERENCES: PreferencesRecord = {
  dashboardSort: 'priority',
  dashboardView: 'list',
  defaultFolderId: null,
  defaultGraceMinutes: 5,
  defaultIntervalMinutes: 60,
  density: 'compact',
  displayName: null,
  notifyOnOpen: true,
  notifyOnResolve: true,
  reminderIntervalMinutes: null,
  timeFormat: '24h',
  timezone: 'Europe/Paris',
  weeklyReportEnabled: true,
}

export interface PreferencesPort {
  find(tenantId: string): Promise<PreferencesRecord | null>
  insert(tenantId: string, record: PreferencesRecord): Promise<void>
  update(tenantId: string, changes: Partial<PreferencesRecord>): Promise<void>
}

export class AccountPreferencesService {
  constructor(private readonly port: PreferencesPort) {}

  async get(tenantId: string): Promise<PreferencesRecord> {
    return (await this.port.find(tenantId)) ?? DEFAULT_PREFERENCES
  }

  async update(
    tenantId: string,
    changes: Partial<PreferencesRecord>,
  ): Promise<PreferencesRecord> {
    const current = await this.port.find(tenantId)
    const next: PreferencesRecord = {
      ...(current ?? DEFAULT_PREFERENCES),
      ...changes,
    }

    if (current) {
      await this.port.update(tenantId, changes)
    } else {
      await this.port.insert(tenantId, next)
    }

    return next
  }
}

export type MonitorDetailsChanges = Readonly<{
  alertsEnabled?: boolean
  description?: string | null
  name?: string | null
  notes?: string | null
  tags?: readonly string[]
}>

export interface MonitorDetailsPort {
  update(
    tenantId: string,
    monitorId: string,
    changes: MonitorDetailsChanges,
  ): Promise<boolean>
}

export class ManageMonitorDetails {
  constructor(private readonly port: MonitorDetailsPort) {}

  update(
    tenantId: string,
    monitorId: string,
    changes: MonitorDetailsChanges,
  ): Promise<boolean> {
    return this.port.update(tenantId, monitorId, changes)
  }
}
