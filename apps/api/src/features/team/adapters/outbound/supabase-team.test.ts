import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import {
  InvitationExistsError,
  InvitationLimitError,
  TeamForbiddenError,
} from '../../application/team.ts'
import { SupabaseTeamStore } from './supabase-team.ts'

function client(result: object) {
  const calls: [string, unknown[]][] = []
  const builder: Record<string, unknown> = {}

  for (const method of [
    'select',
    'eq',
    'is',
    'gt',
    'order',
    'insert',
    'update',
  ] as const) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args])

      return builder
    }
  }
  builder.single = async () => result
  builder.then = (resolve: (value: unknown) => void) => resolve(result)
  const rpc = vi.fn(async () => result)

  return {
    calls,
    rpc,
    supabase: { from: vi.fn(() => builder), rpc } as unknown as SupabaseClient,
  }
}

const INVITATION_ROW = {
  created_at: '2026-10-31T12:00:00+00:00',
  email: 'a@b.co',
  expires_at: '2026-11-07T12:00:00+00:00',
  id: 'i1',
  role: 'viewer',
}
const INPUT = {
  email: 'a@b.co',
  invitedBy: 'u1',
  role: 'viewer' as const,
  tenantId: 't1',
  tokenHash: 'h'.repeat(64),
}

describe('SupabaseTeamStore', () => {
  it('maps members and spaces from the SQL functions', async () => {
    const members = client({
      data: [
        {
          email: 'o@x.co',
          joined_at: '2026-10-31T12:00:00+00:00',
          role: 'owner',
          user_id: 'u1',
        },
      ],
      error: null,
    })

    await expect(
      new SupabaseTeamStore(members.supabase).listMembers('t1'),
    ).resolves.toEqual([
      {
        email: 'o@x.co',
        joinedAt: '2026-10-31T12:00:00.000Z',
        role: 'owner',
        userId: 'u1',
      },
    ])
    expect(members.rpc).toHaveBeenCalledWith('list_tenant_members', {
      p_tenant_id: 't1',
    })

    const spaces = client({
      data: [{ owner_email: 'o@x.co', role: 'viewer', tenant_id: 't2' }],
      error: null,
    })

    await expect(
      new SupabaseTeamStore(spaces.supabase).listSpaces(),
    ).resolves.toEqual([
      { ownerEmail: 'o@x.co', role: 'viewer', tenantId: 't2' },
    ])
  })

  it('lists only pending, unexpired invitations of the tenant', async () => {
    const { calls, supabase } = client({ data: [INVITATION_ROW], error: null })
    const invitations = await new SupabaseTeamStore(supabase).listInvitations(
      't1',
    )

    expect(invitations[0]).toMatchObject({ id: 'i1', role: 'viewer' })
    expect(calls).toContainEqual(['eq', ['tenant_id', 't1']])
    expect(calls).toContainEqual(['is', ['accepted_at', null]])
    expect(calls).toContainEqual(['is', ['revoked_at', null]])
    expect(JSON.stringify(calls)).not.toContain('token_hash')
  })

  it('creates an invitation with the hash and maps database errors', async () => {
    const ok = client({ data: INVITATION_ROW, error: null })

    await new SupabaseTeamStore(ok.supabase).createInvitation(INPUT)
    expect(ok.calls).toContainEqual([
      'insert',
      [
        {
          email: 'a@b.co',
          invited_by: 'u1',
          role: 'viewer',
          tenant_id: 't1',
          token_hash: 'h'.repeat(64),
        },
      ],
    ])

    const create = (code: string) =>
      new SupabaseTeamStore(
        client({ data: null, error: { code } }).supabase,
      ).createInvitation(INPUT)

    await expect(create('23505')).rejects.toBeInstanceOf(InvitationExistsError)
    await expect(create('54000')).rejects.toBeInstanceOf(InvitationLimitError)
    await expect(create('42501')).rejects.toBeInstanceOf(TeamForbiddenError)
    await expect(create('XX000')).rejects.toThrow('invitation creation failed')
  })

  it('revokes only pending invitations', async () => {
    const { calls, supabase } = client({ data: [{ id: 'i1' }], error: null })

    await expect(
      new SupabaseTeamStore(supabase).revokeInvitation('t1', 'i1'),
    ).resolves.toBe(true)
    expect(calls).toContainEqual(['is', ['accepted_at', null]])
    await expect(
      new SupabaseTeamStore(
        client({ data: [], error: null }).supabase,
      ).revokeInvitation('t1', 'i1'),
    ).resolves.toBe(false)
  })

  it('accepts an invitation by hash and returns the joined space or null', async () => {
    const joined = client({ data: 't2', error: null })

    await expect(
      new SupabaseTeamStore(joined.supabase).acceptInvitation('h'),
    ).resolves.toBe('t2')
    expect(joined.rpc).toHaveBeenCalledWith('accept_tenant_invitation', {
      p_token_hash: 'h',
    })
    await expect(
      new SupabaseTeamStore(
        client({ data: null, error: null }).supabase,
      ).acceptInvitation('h'),
    ).resolves.toBeNull()
  })

  it('changes roles and removes members through the SQL functions', async () => {
    const ok = client({ data: true, error: null })
    const store = new SupabaseTeamStore(ok.supabase)

    await expect(store.setRole('t1', 'u2', 'member')).resolves.toBe(true)
    expect(ok.rpc).toHaveBeenCalledWith('set_member_role', {
      p_role: 'member',
      p_tenant_id: 't1',
      p_user_id: 'u2',
    })
    await expect(store.removeMember('t1', 'u2')).resolves.toBe(true)
    expect(ok.rpc).toHaveBeenCalledWith('remove_tenant_member', {
      p_tenant_id: 't1',
      p_user_id: 'u2',
    })
  })

  it('maps forbidden calls and hides other failures', async () => {
    const forbidden = new SupabaseTeamStore(
      client({ data: null, error: { code: '42501' } }).supabase,
    )

    await expect(forbidden.setRole('t', 'u', 'member')).rejects.toBeInstanceOf(
      TeamForbiddenError,
    )
    await expect(forbidden.removeMember('t', 'u')).rejects.toBeInstanceOf(
      TeamForbiddenError,
    )

    const failing = new SupabaseTeamStore(
      client({ data: null, error: { code: 'XX000' } }).supabase,
    )

    await expect(failing.setRole('t', 'u', 'member')).rejects.toThrow(
      'role change failed',
    )
    await expect(failing.removeMember('t', 'u')).rejects.toThrow(
      'member removal failed',
    )
    await expect(failing.listMembers('t')).rejects.toThrow(
      'team members query failed',
    )
    await expect(failing.listSpaces()).rejects.toThrow('spaces query failed')
    await expect(failing.listInvitations('t')).rejects.toThrow(
      'invitations query failed',
    )
    await expect(failing.acceptInvitation('h')).rejects.toThrow(
      'invitation acceptance failed',
    )
    await expect(failing.revokeInvitation('t', 'i')).rejects.toThrow(
      'invitation revocation failed',
    )
  })
})
