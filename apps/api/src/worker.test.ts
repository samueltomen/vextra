import { describe, expect, it } from 'vitest'

import { type WorkerEnvironment } from './composition.ts'
import worker from './worker.ts'

const ENVIRONMENT: WorkerEnvironment = {
  APP_ORIGIN: 'https://app.cronping.test',
  PING_TOKEN_PEPPER: 'pepper-with-at-least-thirty-two-characters',
  SESSION_ENCRYPTION_KEY: 'session-secret-with-at-least-32-bytes-of-entropy',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_URL: 'https://project.supabase.test',
}

describe('Cloudflare Worker entrypoint', () => {
  it('serves requests when configuration is present', async () => {
    const response = await worker.fetch(
      new Request('https://api.cronping.test/api/health'),
      ENVIRONMENT,
    )

    expect(response.status).toBe(200)
  })

  it('returns a safe error when configuration is missing', async () => {
    const response = await worker.fetch(
      new Request('https://api.cronping.test/api/health'),
      {} as WorkerEnvironment,
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'service_unavailable',
        message: 'Service is not configured',
      },
    })
  })
})
