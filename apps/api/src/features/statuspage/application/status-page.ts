import type { PublicStatusPage } from '@vextra/contracts'

export type StatusPageConfig = Readonly<{
  description: string | null
  enabled: boolean
  slug: string
  title: string
}>

export type StatusPageSettings = Readonly<{
  monitorIds: readonly string[]
  page: StatusPageConfig | null
}>

export type SaveStatusPageInput = StatusPageConfig &
  Readonly<{ monitorIds: readonly string[] }>

export class StatusPageSlugTakenError extends Error {
  constructor() {
    super('status page slug is already taken')
    this.name = 'StatusPageSlugTakenError'
  }
}

export interface StatusPageSettingsPort {
  get(tenantId: string): Promise<StatusPageSettings>
  save(tenantId: string, input: SaveStatusPageInput): Promise<void>
}

export interface PublicStatusPagePort {
  read(slug: string): Promise<PublicStatusPage | null>
}

export class ManageStatusPage {
  constructor(private readonly port: StatusPageSettingsPort) {}

  get(tenantId: string): Promise<StatusPageSettings> {
    return this.port.get(tenantId)
  }

  async save(
    tenantId: string,
    input: SaveStatusPageInput,
  ): Promise<StatusPageSettings> {
    await this.port.save(tenantId, {
      ...input,
      monitorIds: [...new Set(input.monitorIds)],
    })

    return this.port.get(tenantId)
  }
}

export class ReadPublicStatusPage {
  constructor(private readonly port: PublicStatusPagePort) {}

  read(slug: string): Promise<PublicStatusPage | null> {
    return this.port.read(slug)
  }
}
