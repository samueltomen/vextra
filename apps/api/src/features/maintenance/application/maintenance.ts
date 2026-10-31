import type {
  CreateMaintenanceRequest,
  MaintenanceWindow,
} from '@vextra/contracts'

export class MaintenanceLimitError extends Error {
  constructor() {
    super('maintenance window limit reached')
    this.name = 'MaintenanceLimitError'
  }
}

export class MaintenanceMonitorNotFoundError extends Error {
  constructor() {
    super('monitor not found for the maintenance window')
    this.name = 'MaintenanceMonitorNotFoundError'
  }
}

export interface MaintenancePort {
  create(
    tenantId: string,
    input: CreateMaintenanceRequest,
  ): Promise<MaintenanceWindow>
  list(tenantId: string): Promise<readonly MaintenanceWindow[]>
  remove(tenantId: string, windowId: string): Promise<boolean>
}

/** Lists windows that are running or still to come, soonest first. */
export class ManageMaintenance {
  constructor(private readonly port: MaintenancePort) {}

  list(tenantId: string) {
    return this.port.list(tenantId)
  }

  create(tenantId: string, input: CreateMaintenanceRequest) {
    return this.port.create(tenantId, input)
  }

  remove(tenantId: string, windowId: string) {
    return this.port.remove(tenantId, windowId)
  }
}
