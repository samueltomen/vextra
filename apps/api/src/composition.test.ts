import { describe, expect, it } from 'vitest'

import {
  createApiFromEnvironment,
  type WorkerEnvironment,
} from './composition.ts'

const ENVIRONMENT: WorkerEnvironment = {
  APP_ORIGIN: 'https://app.cronping.test',
  PING_TOKEN_PEPPER: 'pepper-with-at-least-thirty-two-characters',
  SESSION_ENCRYPTION_KEY: 'session-secret-with-at-least-32-bytes-of-entropy',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  SUPABASE_URL: 'https://project.supabase.test',
}

describe('API composition root', () => {
  it('builds the real routes and keeps health public', async () => {
    const app = createApiFromEnvironment(ENVIRONMENT)
    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
  })

  it('fails closed when a monitor request has no session cookie', async () => {
    const app = createApiFromEnvironment(ENVIRONMENT)
    const response = await app.request('/api/monitors', {
      headers: { origin: ENVIRONMENT.APP_ORIGIN },
      method: 'POST',
    })

    expect(response.status).toBe(401)
  })
})
