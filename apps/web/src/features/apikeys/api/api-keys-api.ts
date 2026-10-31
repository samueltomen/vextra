import type {
  ApiKeyView,
  CreateApiKeyResponse,
  ListApiKeysResponse,
} from '@vextra/contracts'

import { apiRequest } from '../../../api/client.ts'
import { isDemoModeEnabled } from '../../../demo/demo-mode.ts'

export type CreatedApiKey = CreateApiKeyResponse['data']

let demoKeys: ApiKeyView[] = []

export async function listApiKeys(): Promise<readonly ApiKeyView[]> {
  if (isDemoModeEnabled()) {
    return demoKeys
  }

  return (await apiRequest<ListApiKeysResponse>('/api/api-keys')).data.keys
}

export async function createApiKey(name: string): Promise<CreatedApiKey> {
  if (isDemoModeEnabled()) {
    const secret = `vx_${crypto.randomUUID().replaceAll('-', '').padEnd(43, 'x')}`
    const apiKey: ApiKeyView = {
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID(),
      lastUsedAt: null,
      name,
      prefix: secret.slice(0, 10),
      revokedAt: null,
    }

    demoKeys = [apiKey, ...demoKeys]

    return { apiKey, key: secret }
  }

  return (
    await apiRequest<CreateApiKeyResponse>('/api/api-keys', {
      body: JSON.stringify({ name }),
      method: 'POST',
    })
  ).data
}

export async function revokeApiKey(keyId: string): Promise<void> {
  if (isDemoModeEnabled()) {
    demoKeys = demoKeys.map((key) =>
      key.id === keyId ? { ...key, revokedAt: new Date().toISOString() } : key,
    )

    return
  }

  await apiRequest<void>(`/api/api-keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
  })
}
