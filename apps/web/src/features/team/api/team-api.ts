import type {
  Invitation,
  InviteMemberRequest,
  Space,
  TeamMember,
} from '@vextra/contracts'

import { apiRequest } from '../../../api/client.ts'
import { isDemoModeEnabled } from '../../../demo/demo-mode.ts'
import { DEMO_ACCOUNT } from '../../../demo/demo-account.ts'
import type {
  CurrentAccount,
  MembershipRole,
} from '../../accounts/model/account.ts'

export type TeamView = Readonly<{
  members: readonly TeamMember[]
  role: MembershipRole
  userId: string
}>

export type CreatedInvitation = Readonly<{
  invitation: Invitation
  token: string
}>

export async function getTeam(): Promise<TeamView> {
  if (isDemoModeEnabled()) {
    return {
      members: [
        {
          email: DEMO_ACCOUNT.user.email,
          joinedAt: new Date().toISOString(),
          role: 'owner',
          userId: DEMO_ACCOUNT.user.id,
        },
      ],
      role: 'owner',
      userId: DEMO_ACCOUNT.user.id,
    }
  }

  return (await apiRequest<{ data: TeamView }>('/api/team/members')).data
}

export async function listSpaces(): Promise<readonly Space[]> {
  if (isDemoModeEnabled()) {
    return [
      {
        ownerEmail: DEMO_ACCOUNT.user.email,
        role: 'owner',
        tenantId: DEMO_ACCOUNT.tenantId,
      },
    ]
  }

  return (await apiRequest<{ data: { spaces: Space[] } }>('/api/team/spaces'))
    .data.spaces
}

export async function listInvitations(): Promise<readonly Invitation[]> {
  if (isDemoModeEnabled()) {
    return []
  }

  return (
    await apiRequest<{ data: { invitations: Invitation[] } }>(
      '/api/team/invitations',
    )
  ).data.invitations
}

export async function inviteMember(
  request: InviteMemberRequest,
): Promise<CreatedInvitation> {
  return (
    await apiRequest<{ data: CreatedInvitation }>('/api/team/invitations', {
      body: JSON.stringify(request),
      method: 'POST',
    })
  ).data
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  await apiRequest<void>(
    `/api/team/invitations/${encodeURIComponent(invitationId)}`,
    { method: 'DELETE' },
  )
}

export async function changeMemberRole(
  userId: string,
  role: 'member' | 'viewer',
): Promise<void> {
  await apiRequest<void>(`/api/team/members/${encodeURIComponent(userId)}`, {
    body: JSON.stringify({ role }),
    method: 'PATCH',
  })
}

export async function removeMember(userId: string): Promise<void> {
  await apiRequest<void>(`/api/team/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
}

/** Resolves to the joined space id, or `null` when the invitation is unusable. */
export async function acceptInvitation(token: string): Promise<string | null> {
  try {
    return (
      await apiRequest<{ data: { tenantId: string } }>(
        '/api/team/invitations/accept',
        { body: JSON.stringify({ token }), method: 'POST' },
      )
    ).data.tenantId
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      (error as { status: number }).status === 404
    ) {
      return null
    }

    throw error
  }
}

export async function switchSpace(tenantId: string): Promise<CurrentAccount> {
  return (
    await apiRequest<{ data: CurrentAccount }>('/api/auth/tenant', {
      body: JSON.stringify({ tenantId }),
      method: 'POST',
    })
  ).data
}
