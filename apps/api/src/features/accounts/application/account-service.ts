export type AuthUser = Readonly<{
  id: string
  email: string
}>

export type SessionTokens = Readonly<{
  accessToken: string
  refreshToken: string
  expiresAtMs: number
  /** Space the user last switched to; verified against memberships on use. */
  tenantId?: string | undefined
}>

export type MembershipRole = 'member' | 'owner' | 'viewer'

export type ResolvedMembership = Readonly<{
  role: MembershipRole
  tenantId: string
}>

export type ProviderSession = Readonly<{
  session: SessionTokens | null
  user: AuthUser
}>

export type AuthenticatedAccount = Readonly<{
  refreshed: boolean
  role: MembershipRole
  tenantId: string
  tokens: SessionTokens
  user: AuthUser
}>

export type SignUpResult = Readonly<
  | {
      requiresEmailConfirmation: true
      user: AuthUser
    }
  | {
      requiresEmailConfirmation: false
      session: AuthenticatedAccount
      user: AuthUser
    }
>

export type Credentials = Readonly<{
  email: string
  password: string
}>

export interface AccountsGateway {
  getUser(accessToken: string): Promise<AuthUser>
  refreshSession(refreshToken: string): Promise<ProviderSession>
  /** The preferred space if the user still belongs to it, else the oldest. */
  resolvePrimaryTenantId(input: {
    accessToken: string
    preferredTenantId?: string | undefined
    userId: string
  }): Promise<ResolvedMembership | null>
  revokeSession(accessToken: string): Promise<void>
  signIn(input: Credentials): Promise<ProviderSession>
  signUp(input: Credentials): Promise<ProviderSession>
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Authentication failed')
    this.name = 'InvalidCredentialsError'
  }
}

export class AccountCreationError extends Error {
  constructor() {
    super('Account creation failed')
    this.name = 'AccountCreationError'
  }
}

export class AccountStateError extends Error {
  constructor() {
    super('Account state is incomplete')
    this.name = 'AccountStateError'
  }
}

const REFRESH_MARGIN_MS = 60_000

export class AccountService {
  constructor(
    private readonly dependencies: Readonly<{
      clock: Readonly<{ nowMs: () => number }>
      gateway: AccountsGateway
    }>,
  ) {}

  async signIn(credentials: Credentials): Promise<AuthenticatedAccount> {
    let providerSession: ProviderSession

    try {
      providerSession = await this.dependencies.gateway.signIn(credentials)
    } catch {
      throw new InvalidCredentialsError()
    }

    const session = providerSession.session

    if (!session) {
      throw new AccountStateError()
    }

    return this.resolveAuthenticatedAccount(
      { session, user: providerSession.user },
      false,
    )
  }

  async signUp(credentials: Credentials): Promise<SignUpResult> {
    let providerSession: ProviderSession

    try {
      providerSession = await this.dependencies.gateway.signUp(credentials)
    } catch {
      throw new AccountCreationError()
    }

    const session = providerSession.session

    if (!session) {
      return {
        requiresEmailConfirmation: true,
        user: providerSession.user,
      }
    }

    try {
      const authenticated = await this.resolveAuthenticatedAccount(
        { session, user: providerSession.user },
        false,
      )

      return {
        requiresEmailConfirmation: false,
        session: authenticated,
        user: providerSession.user,
      }
    } catch {
      throw new AccountCreationError()
    }
  }

  async authenticate(
    tokens: SessionTokens,
  ): Promise<AuthenticatedAccount | null> {
    try {
      const shouldRefresh =
        tokens.expiresAtMs <=
        this.dependencies.clock.nowMs() + REFRESH_MARGIN_MS

      if (shouldRefresh) {
        return await this.refresh(tokens)
      }

      try {
        const user = await this.dependencies.gateway.getUser(tokens.accessToken)

        return await this.resolveAuthenticatedAccount(
          { session: tokens, user },
          false,
          tokens.tenantId,
        )
      } catch {
        return await this.refresh(tokens)
      }
    } catch {
      return null
    }
  }

  async revoke(tokens: SessionTokens): Promise<void> {
    try {
      await this.dependencies.gateway.revokeSession(tokens.accessToken)
    } catch {
      // The local cookie is still cleared by the HTTP adapter.
    }
  }

  private async refresh(
    expiredTokens: SessionTokens,
  ): Promise<AuthenticatedAccount> {
    const refreshed = await this.dependencies.gateway.refreshSession(
      expiredTokens.refreshToken,
    )

    const session = refreshed.session

    if (!session) {
      throw new AccountStateError()
    }

    return this.resolveAuthenticatedAccount(
      { session, user: refreshed.user },
      true,
      expiredTokens.tenantId,
    )
  }

  private async resolveAuthenticatedAccount(
    providerSession: ProviderSession & { session: SessionTokens },
    refreshed: boolean,
    preferredTenantId?: string,
  ): Promise<AuthenticatedAccount> {
    const membership = await this.dependencies.gateway.resolvePrimaryTenantId({
      accessToken: providerSession.session.accessToken,
      preferredTenantId,
      userId: providerSession.user.id,
    })

    if (!membership) {
      throw new AccountStateError()
    }

    return {
      refreshed,
      role: membership.role,
      tenantId: membership.tenantId,
      // The resolved space is persisted so a refresh keeps the user in it.
      tokens: { ...providerSession.session, tenantId: membership.tenantId },
      user: providerSession.user,
    }
  }
}
