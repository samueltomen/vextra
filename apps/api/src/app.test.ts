import { describe, expect, it } from 'vitest'

import { app } from './app.ts'

describe('GET /api/health', () => {
  it('reports that the API is ready', async () => {
    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      service: 'cronping-api',
      status: 'ok',
    })
  })
})
