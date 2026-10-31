import { z } from 'zod'

export const createApiKeyRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(60),
})

export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>

export const apiKeyViewSchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  lastUsedAt: z.string().nullable(),
  name: z.string(),
  prefix: z.string(),
  revokedAt: z.string().nullable(),
})

export const listApiKeysResponseSchema = z.object({
  data: z.object({ keys: z.array(apiKeyViewSchema) }),
})

export const createApiKeyResponseSchema = z.object({
  data: z.object({ key: z.string(), apiKey: apiKeyViewSchema }),
})

export type ApiKeyView = z.infer<typeof apiKeyViewSchema>
export type ListApiKeysResponse = z.infer<typeof listApiKeysResponseSchema>
export type CreateApiKeyResponse = z.infer<typeof createApiKeyResponseSchema>
