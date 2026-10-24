import { describe, expect, it, vi } from 'vitest'

import { createAccountRoutes } from './account-routes.ts'

function createApp(
  authenticate: () => Promise<{
    deleteAccount: { execute: (userId: string) => Promise<void> }
    userId: string
  } | null> = async () => ({
    deleteAccount: { execute: vi.fn(async () => undefined) },
    userId: '00000000-0000-4000-8000-000000000001',
  }),
) {
  return createAccountRoutes({ authenticate })
}

describe('DELETE /api/account', () => {
  it('requires an authenticated account', async () => {
    const app = createApp(async () => null)
    const response = await app.request('/api/account', { method: 'DELETE' })

    expect(response.status).toBe(401)
  })

  it('deletes the session user and clears the cookie', async () => {
    const execute = vi.fn(async () => undefined)
    const app = createApp(async () => ({
      deleteAccount: { execute },
      userId: '00000000-0000-4000-8000-000000000001',
    }))
    const response = await app.request('/api/account', { method: 'DELETE' })

    expect(response.status).toBe(204)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(execute).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
    )
  })

  it('does not expose provider failures', async () => {
    const app = createApp(async () => ({
      deleteAccount: {
        execute: async () => {
          throw new Error('provider detail')
        },
      },
      userId: '00000000-0000-4000-8000-000000000001',
    }))
    const response = await app.request('/api/account', { method: 'DELETE' })

    expect(response.status).toBe(500)
  })
})
