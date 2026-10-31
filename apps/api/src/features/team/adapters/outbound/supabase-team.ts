import type { SupabaseClient } from '@supabase/supabase-js'
import type { Invitation, Space, TeamMember } from '@vextra/contracts'

import {
  InvitationExistsError,
  InvitationLimitError,
  TeamForbiddenError,
  type InvitableRole,
  type TeamStorePort,
} from '../../application/team.ts'

type InvitationRow = Readonly<{
  created_at: string
  email: string
  expires_at: string
  id: string
  role: InvitableRole
}>

const INVITATION_COLUMNS = 'id, email, role, created_at, expires_at'

function iso(value: string): string {
  return new Date(value).toISOString()
}

function toInvitation(row: InvitationRow): Invitation {
  return {
    createdAt: iso(row.created_at),
    email: row.email,
    expiresAt: iso(row.expires_at),
    id: row.id,
    role: row.role,
  }
}

/** Runs under the signed-in user's RLS and security-definer functions. */
export class SupabaseTeamStore implements TeamStorePort {
  constructor(private readonly client: SupabaseClient) {}

  async listMembers(tenantId: string): Promise<readonly TeamMember[]> {
    const { data, error } = await this.client.rpc('list_tenant_members', {
      p_tenant_id: tenantId,
    })

    if (error) {
      throw new Error('team members query failed')
    }

    return (
      (data ?? []) as readonly {
        email: string
        joined_at: string
        role: TeamMember['role']
        user_id: string
      }[]
    ).map((row) => ({
      email: row.email,
      joinedAt: iso(row.joined_at),
      role: row.role,
      userId: row.user_id,
    }))
  }

  async listSpaces(): Promise<readonly Space[]> {
    const { data, error } = await this.client.rpc('list_my_tenants')

    if (error) {
      throw new Error('spaces query failed')
    }

    return (
      (data ?? []) as readonly {
        owner_email: string | null
        role: Space['role']
        tenant_id: string
      }[]
    ).map((row) => ({
      ownerEmail: row.owner_email,
      role: row.role,
      tenantId: row.tenant_id,
    }))
  }

  async listInvitations(tenantId: string): Promise<readonly Invitation[]> {
    const { data, error } = await this.client
      .from('tenant_invitations')
      .select(INVITATION_COLUMNS)
      .eq('tenant_id', tenantId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error('invitations query failed')
    }

    return ((data ?? []) as readonly InvitationRow[]).map(toInvitation)
  }

  async createInvitation(
    input: Readonly<{
      email: string
      invitedBy: string
      role: InvitableRole
      tenantId: string
      tokenHash: string
    }>,
  ): Promise<Invitation> {
    const { data, error } = await this.client
      .from('tenant_invitations')
      .insert({
        email: input.email,
        invited_by: input.invitedBy,
        role: input.role,
        tenant_id: input.tenantId,
        token_hash: input.tokenHash,
      })
      .select(INVITATION_COLUMNS)
      .single()

    if (error || !data) {
      if (error?.code === '23505') {
        throw new InvitationExistsError()
      }

      if (error?.code === '54000') {
        throw new InvitationLimitError()
      }

      if (error?.code === '42501') {
        throw new TeamForbiddenError()
      }

      throw new Error('invitation creation failed')
    }

    return toInvitation(data as InvitationRow)
  }

  async revokeInvitation(
    tenantId: string,
    invitationId: string,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from('tenant_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', invitationId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .select('id')

    if (error) {
      throw new Error('invitation revocation failed')
    }

    return (data ?? []).length > 0
  }

  async acceptInvitation(tokenHash: string): Promise<string | null> {
    const { data, error } = await this.client.rpc('accept_tenant_invitation', {
      p_token_hash: tokenHash,
    })

    if (error) {
      throw new Error('invitation acceptance failed')
    }

    return typeof data === 'string' ? data : null
  }

  async setRole(
    tenantId: string,
    userId: string,
    role: InvitableRole,
  ): Promise<boolean> {
    const { data, error } = await this.client.rpc('set_member_role', {
      p_role: role,
      p_tenant_id: tenantId,
      p_user_id: userId,
    })

    if (error) {
      if (error.code === '42501') {
        throw new TeamForbiddenError()
      }

      throw new Error('role change failed')
    }

    return data === true
  }

  async removeMember(tenantId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('remove_tenant_member', {
      p_tenant_id: tenantId,
      p_user_id: userId,
    })

    if (error) {
      if (error.code === '42501') {
        throw new TeamForbiddenError()
      }

      throw new Error('member removal failed')
    }

    return data === true
  }
}
