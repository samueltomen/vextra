import type { ApiKeyView } from '@vextra/contracts'

export class ApiKeyLimitError extends Error {
  constructor() {
    super('api key limit reached')
    this.name = 'ApiKeyLimitError'
  }
}

export type GeneratedApiKey = Readonly<{
  hash: string
  key: string
  prefix: string
}>

export interface ApiKeyGeneratorPort {
  generate(): Promise<GeneratedApiKey>
  hash(key: string): Promise<string>
}

export interface ApiKeyStorePort {
  insert(
    tenantId: string,
    input: Readonly<{ hash: string; name: string; prefix: string }>,
  ): Promise<ApiKeyView>
  list(tenantId: string): Promise<readonly ApiKeyView[]>
  revoke(tenantId: string, keyId: string): Promise<boolean>
}

export interface ApiKeyAuthenticatorPort {
  /** Returns the tenant of a valid, non-revoked key hash. */
  authenticate(hash: string): Promise<string | null>
}

const KEY_PATTERN = /^vx_[A-Za-z0-9_-]{43}$/

export class ManageApiKeys {
  constructor(
    private readonly dependencies: Readonly<{
      generator: ApiKeyGeneratorPort
      store: ApiKeyStorePort
    }>,
  ) {}

  list(tenantId: string) {
    return this.dependencies.store.list(tenantId)
  }

  /** The secret is returned once and never stored. */
  async create(
    tenantId: string,
    name: string,
  ): Promise<Readonly<{ apiKey: ApiKeyView; key: string }>> {
    const generated = await this.dependencies.generator.generate()
    const apiKey = await this.dependencies.store.insert(tenantId, {
      hash: generated.hash,
      name,
      prefix: generated.prefix,
    })

    return { apiKey, key: generated.key }
  }

  revoke(tenantId: string, keyId: string) {
    return this.dependencies.store.revoke(tenantId, keyId)
  }
}

export class AuthenticateApiKey {
  constructor(
    private readonly dependencies: Readonly<{
      authenticator: ApiKeyAuthenticatorPort
      generator: ApiKeyGeneratorPort
    }>,
  ) {}

  /** Returns the tenant of the presented bearer secret, or `null`. */
  async tenantFor(presentedKey: string): Promise<string | null> {
    if (!KEY_PATTERN.test(presentedKey)) {
      return null
    }

    return this.dependencies.authenticator.authenticate(
      await this.dependencies.generator.hash(presentedKey),
    )
  }
}
