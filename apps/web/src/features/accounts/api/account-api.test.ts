import { describe, expect, it, vi } from 'vitest'

import { TEST_ACCOUNT } from '../../../test/api-mock.ts'
import { getCurrentAccount, signIn, signOut, signUp } from './account-api.ts'

describe('account API', () => {
  it('treats an unauthenticated session as a normal signed-out state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: { code: 'unauthorized', message: 'Authentication required' },
          },
          { status: 401 },
        ),
      ),
    )

    await expect(getCurrentAccount()).resolves.toBeNull()
  })

  it('returns only the public account payload for sign in', async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: TEST_ACCOUNT }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      signIn({
        email: 'alice@example.test',
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual(TEST_ACCOUNT)
  })

  it('returns the email-confirmation state after signup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          data: {
            requiresEmailConfirmation: true,
            user: TEST_ACCOUNT.user,
          },
        }),
      ),
    )

    await expect(
      signUp({
        email: 'alice@example.test',
        password: 'correct horse battery staple',
      }),
    ).resolves.toEqual({
      requiresEmailConfirmation: true,
      user: TEST_ACCOUNT.user,
    })
  })

  it('posts logout as a cookie-authenticated mutation', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await signOut()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    )
  })
})
