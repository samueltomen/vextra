import {
  publicStatusPageSchema,
  type PublicStatusPage,
} from '@vextra/contracts'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  StatusPageSlugTakenError,
  type PublicStatusPagePort,
  type SaveStatusPageInput,
  type StatusPageSettings,
  type StatusPageSettingsPort,
} from '../../application/status-page.ts'

type PageRow = Readonly<{
  description: string | null
  enabled: boolean
  slug: string
  title: string
}>

/** Runs under the signed-in user's RLS: only the tenant's own page is visible. */
export class SupabaseStatusPageSettings implements StatusPageSettingsPort {
  constructor(private readonly client: SupabaseClient) {}

  async get(tenantId: string): Promise<StatusPageSettings> {
    const page = await this.client
      .from('status_pages')
      .select('slug, title, description, enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    const monitors = await this.client
      .from('monitors')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('show_on_status_page', true)

    if (page.error || monitors.error) {
      throw new Error('status page query failed')
    }

    const row = page.data as PageRow | null

    return {
      monitorIds: ((monitors.data ?? []) as readonly { id: string }[]).map(
        (monitor) => monitor.id,
      ),
      page: row
        ? {
            description: row.description,
            enabled: row.enabled,
            slug: row.slug,
            title: row.title,
          }
        : null,
    }
  }

  async save(tenantId: string, input: SaveStatusPageInput): Promise<void> {
    const { error } = await this.client.rpc('save_status_page', {
      p_description: input.description,
      p_enabled: input.enabled,
      p_monitor_ids: [...input.monitorIds],
      p_slug: input.slug,
      p_tenant_id: tenantId,
      p_title: input.title,
    })

    if (error) {
      if (error.code === '23505') {
        throw new StatusPageSlugTakenError()
      }

      throw new Error('status page save failed')
    }
  }
}

/** Uses an anonymous client: the SQL function is the only public surface. */
export class SupabasePublicStatusPage implements PublicStatusPagePort {
  constructor(private readonly anonymousClient: SupabaseClient) {}

  async read(slug: string): Promise<PublicStatusPage | null> {
    const { data, error } = await this.anonymousClient.rpc(
      'get_public_status_page',
      { p_slug: slug },
    )

    if (error) {
      throw new Error('public status page query failed')
    }

    if (data === null) {
      return null
    }

    const parsed = publicStatusPageSchema.safeParse(data)

    if (!parsed.success) {
      throw new Error('public status page is malformed')
    }

    return parsed.data
  }
}
