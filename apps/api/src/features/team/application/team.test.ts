import { describe, expect, it, vi } from 'vitest'

import { ManageTeam, type TeamStorePort } from './team.ts'

function setup() {
  const store = {
    acceptInvitation: vi.fn(async () => 'tenant-b' as string | null),
    createInvitation: vi.fn(async () => ({ id: 'i1' }) as never),
    listInvitations: vi.fn(async () => []),
    listMembers: vi.fn(async () => []),
    listSpaces: vi.fn(async () => []),
    removeMember: vi.fn(async () => true),
    revokeInvitation: vi.fn(async () => true),
    setRole: vi.fn(async () => true),
  } satisfies TeamStorePort
  const tokens = {
    generate: vi.fn(async () => ({
      hash: 'h'.repeat(64),
      token: 'vxi_secret',
    })),
    hash: vi.fn(async (token: string) => `hash-of-${token}`),
  }

  return { store, team: new ManageTeam({ store, tokens }), tokens }
}

describe('ManageTeam', () => {
  it('stores only the hash of the invitation token and returns the secret once', async () => {
    const { store, team } = setup()
    const result = await team.invite({
      email: 'a@b.co',
      invitedBy: 'u1',
      role: 'viewer',
      tenantId: 't1',
    })

    expect(result.token).toBe('vxi_secret')
    expect(store.createInvitation).toHaveBeenCalledWith({
      email: 'a@b.co',
      invitedBy: 'u1',
      role: 'viewer',
      tenantId: 't1',
      tokenHash: 'h'.repeat(64),
    })
    expect(JSON.stringify(store.createInvitation.mock.calls)).not.toContain(
      'vxi_secret',
    )
  })

  it('accepts an invitation through the hash of the presented token', async () => {
    const { store, team } = setup()

    await expect(team.accept('vxi_abc')).resolves.toBe('tenant-b')
    expect(store.acceptInvitation).toHaveBeenCalledWith('hash-of-vxi_abc')
  })

  it('delegates reads and member changes with the tenant', async () => {
    const { store, team } = setup()

    await team.listMembers('t1')
    await team.listInvitations('t1')
    await team.listSpaces()
    await team.setRole('t1', 'u2', 'member')
    await team.removeMember('t1', 'u2')
    await team.revokeInvitation('t1', 'i1')
    expect(store.listMembers).toHaveBeenCalledWith('t1')
    expect(store.listInvitations).toHaveBeenCalledWith('t1')
    expect(store.setRole).toHaveBeenCalledWith('t1', 'u2', 'member')
    expect(store.removeMember).toHaveBeenCalledWith('t1', 'u2')
    expect(store.revokeInvitation).toHaveBeenCalledWith('t1', 'i1')
  })
})
