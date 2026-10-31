import type { Invitation, Space, TeamMember } from '@vextra/contracts'

export class InvitationLimitError extends Error {
  constructor() {
    super('invitation limit reached')
    this.name = 'InvitationLimitError'
  }
}

export class InvitationExistsError extends Error {
  constructor() {
    super('a pending invitation already exists for this address')
    this.name = 'InvitationExistsError'
  }
}

export class TeamForbiddenError extends Error {
  constructor() {
    super('the operation requires a higher role')
    this.name = 'TeamForbiddenError'
  }
}

export type InvitableRole = 'member' | 'viewer'

export interface TeamStorePort {
  acceptInvitation(tokenHash: string): Promise<string | null>
  createInvitation(
    input: Readonly<{
      email: string
      invitedBy: string
      role: InvitableRole
      tenantId: string
      tokenHash: string
    }>,
  ): Promise<Invitation>
  listInvitations(tenantId: string): Promise<readonly Invitation[]>
  listMembers(tenantId: string): Promise<readonly TeamMember[]>
  listSpaces(): Promise<readonly Space[]>
  removeMember(tenantId: string, userId: string): Promise<boolean>
  revokeInvitation(tenantId: string, invitationId: string): Promise<boolean>
  setRole(
    tenantId: string,
    userId: string,
    role: InvitableRole,
  ): Promise<boolean>
}

export interface InvitationTokenPort {
  generate(): Promise<Readonly<{ hash: string; token: string }>>
  hash(token: string): Promise<string>
}

export class ManageTeam {
  constructor(
    private readonly dependencies: Readonly<{
      store: TeamStorePort
      tokens: InvitationTokenPort
    }>,
  ) {}

  listMembers(tenantId: string) {
    return this.dependencies.store.listMembers(tenantId)
  }

  listSpaces() {
    return this.dependencies.store.listSpaces()
  }

  listInvitations(tenantId: string) {
    return this.dependencies.store.listInvitations(tenantId)
  }

  /** The link token is returned once; only its hash is stored. */
  async invite(
    input: Readonly<{
      email: string
      invitedBy: string
      role: InvitableRole
      tenantId: string
    }>,
  ): Promise<Readonly<{ invitation: Invitation; token: string }>> {
    const { hash, token } = await this.dependencies.tokens.generate()
    const invitation = await this.dependencies.store.createInvitation({
      ...input,
      tokenHash: hash,
    })

    return { invitation, token }
  }

  revokeInvitation(tenantId: string, invitationId: string) {
    return this.dependencies.store.revokeInvitation(tenantId, invitationId)
  }

  setRole(tenantId: string, userId: string, role: InvitableRole) {
    return this.dependencies.store.setRole(tenantId, userId, role)
  }

  removeMember(tenantId: string, userId: string) {
    return this.dependencies.store.removeMember(tenantId, userId)
  }

  /** Returns the joined space, or `null` for any unusable invitation. */
  async accept(token: string): Promise<string | null> {
    return this.dependencies.store.acceptInvitation(
      await this.dependencies.tokens.hash(token),
    )
  }
}
