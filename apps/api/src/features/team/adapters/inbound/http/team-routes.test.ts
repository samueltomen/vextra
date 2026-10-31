import { describe, expect, it, vi } from 'vitest'

import {
  InvitationExistsError,
  InvitationLimitError,
  TeamForbiddenError,
} from '../../../application/team.ts'
import { createTeamRoutes } from './team-routes.ts'

const USER_ID = '70000000-0000-4000-8000-000000000001'
const OTHER_ID = '70000000-0000-4000-8000-000000000002'
const TOKEN = `vxi_${'A'.repeat(43)}`

function setup(
  options: {
    authenticated?: boolean
    role?: 'member' | 'owner' | 'viewer'
  } = {},
) {
  const team = {
    accept: vi.fn(async (): Promise<string | null> => 'tenant-b'),
    invite: vi.fn(async () => ({ invitation: { id: 'i1' }, token: TOKEN })),
    listInvitations: vi.fn(async () => [{ id: 'i1' }]),
    listMembers: vi.fn(async () => [{ userId: USER_ID }]),
    listSpaces: vi.fn(async () => [{ tenantId: 'tenant-a' }]),
    removeMember: vi.fn(async () => true),
    revokeInvitation: vi.fn(async () => true),
    setRole: vi.fn(async () => true),
  }
  const app = createTeamRoutes({
    authenticate: async () =>
      options.authenticated === false
        ? null
        : {
            role: options.role ?? 'owner',
            team: team as never,
            tenantId: 'tenant-a',
            userId: USER_ID,
          },
  })
  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      ...(body === undefined
        ? {}
        : {
            body: typeof body === 'string' ? body : JSON.stringify(body),
            headers: { 'content-type': 'application/json' },
          }),
      method,
    })

  return { send, team }
}

describe('team routes', () => {
  it('requires a session everywhere', async () => {
    const { send } = setup({ authenticated: false })

    for (const [method, path] of [
      ['GET', '/api/team/members'],
      ['GET', '/api/team/spaces'],
      ['GET', '/api/team/invitations'],
      ['POST', '/api/team/invitations'],
      ['POST', '/api/team/invitations/accept'],
      ['DELETE', `/api/team/members/${OTHER_ID}`],
    ] as const) {
      expect(
        (await send(method, path, method === 'GET' ? undefined : {})).status,
      ).toBe(401)
    }
  })

  it('lists members with the caller role and the spaces of the user', async () => {
    const { send, team } = setup({ role: 'viewer' })

    await expect(
      (await send('GET', '/api/team/members')).json(),
    ).resolves.toEqual({
      data: { members: [{ userId: USER_ID }], role: 'viewer', userId: USER_ID },
    })
    expect(team.listMembers).toHaveBeenCalledWith('tenant-a')
    await expect(
      (await send('GET', '/api/team/spaces')).json(),
    ).resolves.toEqual({ data: { spaces: [{ tenantId: 'tenant-a' }] } })
  })

  it('shows pending invitations to owners only', async () => {
    const owner = setup({ role: 'owner' })
    const member = setup({ role: 'member' })

    await expect(
      (await owner.send('GET', '/api/team/invitations')).json(),
    ).resolves.toEqual({ data: { invitations: [{ id: 'i1' }] } })
    await expect(
      (await member.send('GET', '/api/team/invitations')).json(),
    ).resolves.toEqual({ data: { invitations: [] } })
    expect(member.team.listInvitations).not.toHaveBeenCalled()
  })

  it('invites with the session tenant and user, never client-supplied ones', async () => {
    const { send, team } = setup()
    const response = await send('POST', '/api/team/invitations', {
      email: 'Ada@Example.com',
      role: 'member',
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      data: { invitation: { id: 'i1' }, token: TOKEN },
    })
    expect(team.invite).toHaveBeenCalledWith({
      email: 'ada@example.com',
      invitedBy: USER_ID,
      role: 'member',
      tenantId: 'tenant-a',
    })
    expect(
      (
        await send('POST', '/api/team/invitations', {
          email: 'a@b.co',
          role: 'owner',
        })
      ).status,
    ).toBe(422)
    expect(
      (
        await send('POST', '/api/team/invitations', {
          email: 'a@b.co',
          role: 'member',
          tenantId: 'other',
        })
      ).status,
    ).toBe(422)
  })

  it('maps team errors to precise statuses and hides the rest', async () => {
    const { send, team } = setup()
    const body = { email: 'a@b.co', role: 'member' }

    team.invite.mockRejectedValueOnce(new InvitationExistsError())
    expect((await send('POST', '/api/team/invitations', body)).status).toBe(409)
    team.invite.mockRejectedValueOnce(new InvitationLimitError())
    expect((await send('POST', '/api/team/invitations', body)).status).toBe(409)
    team.invite.mockRejectedValueOnce(new TeamForbiddenError())
    expect((await send('POST', '/api/team/invitations', body)).status).toBe(403)
    team.invite.mockRejectedValueOnce(new Error('permission denied'))
    const failed = await send('POST', '/api/team/invitations', body)

    expect(failed.status).toBe(500)
    expect(JSON.stringify(await failed.json())).not.toContain('denied')
  })

  it('accepts an invitation and answers one error for every unusable one', async () => {
    const { send, team } = setup()
    const ok = await send('POST', '/api/team/invitations/accept', {
      token: TOKEN,
    })

    await expect(ok.json()).resolves.toEqual({ data: { tenantId: 'tenant-b' } })
    expect(team.accept).toHaveBeenCalledWith(TOKEN)
    team.accept.mockResolvedValueOnce(null)
    expect(
      (await send('POST', '/api/team/invitations/accept', { token: TOKEN }))
        .status,
    ).toBe(404)
    expect(
      (await send('POST', '/api/team/invitations/accept', { token: 'bad' }))
        .status,
    ).toBe(422)
  })

  it('changes roles, removes members and revokes invitations', async () => {
    const { send, team } = setup()

    expect(
      (await send('PATCH', `/api/team/members/${OTHER_ID}`, { role: 'viewer' }))
        .status,
    ).toBe(204)
    expect(team.setRole).toHaveBeenCalledWith('tenant-a', OTHER_ID, 'viewer')
    expect(
      (await send('PATCH', `/api/team/members/${OTHER_ID}`, { role: 'owner' }))
        .status,
    ).toBe(422)
    expect((await send('DELETE', `/api/team/members/${OTHER_ID}`)).status).toBe(
      204,
    )
    team.removeMember.mockResolvedValueOnce(false)
    expect((await send('DELETE', `/api/team/members/${OTHER_ID}`)).status).toBe(
      404,
    )
    expect((await send('DELETE', '/api/team/members/nope')).status).toBe(404)
    expect(
      (await send('DELETE', `/api/team/invitations/${OTHER_ID}`)).status,
    ).toBe(204)
    team.revokeInvitation.mockResolvedValueOnce(false)
    expect(
      (await send('DELETE', `/api/team/invitations/${OTHER_ID}`)).status,
    ).toBe(404)
    expect((await send('DELETE', '/api/team/invitations/nope')).status).toBe(
      404,
    )
  })

  it('turns a forbidden role change into 403', async () => {
    const { send, team } = setup({ role: 'member' })

    team.setRole.mockRejectedValueOnce(new TeamForbiddenError())
    expect(
      (await send('PATCH', `/api/team/members/${OTHER_ID}`, { role: 'viewer' }))
        .status,
    ).toBe(403)
  })
})
