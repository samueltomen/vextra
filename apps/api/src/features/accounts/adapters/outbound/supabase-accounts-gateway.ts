import type { SupabaseClient } from '@supabase/supabase-js'

import {
  AccountCreationError,
  InvalidCredentialsError,
  type AccountsGateway,
  type AuthUser,
  type Credentials,
  type MembershipRole,
  type ProviderSession,
  type ResolvedMembership,
  type SessionTokens,
} from '../../application/account-service.ts'

type SupabaseSession = Readonly<{
  access_token: string
  expires_at?: number
  refresh_token: string
}>

type SupabaseUser = Readonly<{
  email?: string
  id: string
}>

function normalizeUser(user: SupabaseUser | null): AuthUser {
  if (!user?.email) {
    throw new InvalidCredentialsError()
  }

  return {
    email: user.email,
    id: user.id,
  }
}

function normalizeSession(
  session: SupabaseSession | null,
): SessionTokens | null {
  if (!session) {
    return null
  }

  if (!session.expires_at) {
    throw new InvalidCredentialsError()
  }

  return {
    accessToken: session.access_token,
    expiresAtMs: session.expires_at * 1000,
    refreshToken: session.refresh_token,
  }
}

export class SupabaseAccountsGateway implements AccountsGateway {
  constructor(
    private readonly client: SupabaseClient,
    private readonly createUserClient: (accessToken: string) => SupabaseClient,
  ) {}

  async signUp(credentials: Credentials): Promise<ProviderSession> {
    const { data, error } = await this.client.auth.signUp(credentials)

    if (error || !data.user) {
      console.warn(
        JSON.stringify({
          code: error?.code ?? null,
          event: 'auth.signup_failed',
          status: error?.status ?? null,
        }),
      )
      throw new AccountCreationError()
    }

    return {
      session: normalizeSession(data.session),
      user: normalizeUser(data.user),
    }
  }

  async signIn(credentials: Credentials): Promise<ProviderSession> {
    const { data, error } =
      await this.client.auth.signInWithPassword(credentials)

    if (error || !data.user) {
      throw new InvalidCredentialsError()
    }

    return {
      session: normalizeSession(data.session),
      user: normalizeUser(data.user),
    }
  }

  async refreshSession(refreshToken: string): Promise<ProviderSession> {
    const { data, error } = await this.client.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data.user) {
      throw new InvalidCredentialsError()
    }

    return {
      session: normalizeSession(data.session),
      user: normalizeUser(data.user),
    }
  }

  async getUser(accessToken: string): Promise<AuthUser> {
    const { data, error } = await this.client.auth.getUser(accessToken)

    if (error || !data.user) {
      throw new InvalidCredentialsError()
    }

    return normalizeUser(data.user)
  }

  async resolvePrimaryTenantId(input: {
    accessToken: string
    preferredTenantId?: string | undefined
    userId: string
  }): Promise<ResolvedMembership | null> {
    const client = this.createUserClient(input.accessToken)
    const { data, error } = await client
      .from('tenant_memberships')
      .select('tenant_id, role')
      .eq('user_id', input.userId)
      .order('created_at', { ascending: true })

    if (error || !data || data.length === 0) {
      console.warn(
        JSON.stringify({
          code: error?.code ?? null,
          event: 'auth.tenant_lookup_failed',
        }),
      )

      return null
    }

    const memberships = (data as readonly Record<string, unknown>[]).filter(
      (row): row is { role: MembershipRole; tenant_id: string } =>
        typeof row.tenant_id === 'string' &&
        (row.role === 'owner' ||
          row.role === 'member' ||
          row.role === 'viewer'),
    )
    const chosen =
      memberships.find((row) => row.tenant_id === input.preferredTenantId) ??
      memberships[0]

    return chosen ? { role: chosen.role, tenantId: chosen.tenant_id } : null
  }

  async revokeSession(accessToken: string): Promise<void> {
    const client = this.createUserClient(accessToken)
    const { error } = await client.auth.admin.signOut(accessToken, 'local')

    if (error) {
      throw new InvalidCredentialsError()
    }
  }
}
