import { describe, expect, it, vi } from 'vitest'

import {
  AccountCreationError,
  InvalidCredentialsError,
  type AuthenticatedAccount,
  type SignUpResult,
} from '../../../application/account-service.ts'
import { SessionCookieCodec } from '../../outbound/session-cookie.ts'
import { createAuthRoutes } from './auth-routes.ts'
import { SESSION_COOKIE_NAME, encodeSessionCookie } from './session-cookies.ts'

const SECRET = 'session-secret-with-at-least-32-bytes-of-entropy'
const USER = {
  email: 'alice@example.test',
  id: '00000000-0000-4000-8000-000000000001',
}
const TENANT_ID = '10000000-0000-4000-8000-000000000001'
const TOKENS = {
  accessToken: 'access-token',
  expiresAtMs: 1_800_000_000_000,
  refreshToken: 'refresh-token',
}
const ACCOUNT: AuthenticatedAccount = {
  refreshed: false,
  tenantId: TENANT_ID,
  tokens: TOKENS,
  user: USER,
}

function createRoutes(
  overrides: Partial<{
    authenticate: (
      tokens: typeof TOKENS,
    ) => Promise<AuthenticatedAccount | null>
    revoke: (tokens: typeof TOKENS) => Promise<void>
    signIn: (input: unknown) => Promise<AuthenticatedAccount>
    signUp: (input: unknown) => Promise<SignUpResult>
  }> = {},
) {
  const accounts = {
    authenticate: overrides.authenticate ?? vi.fn(async () => ACCOUNT),
    revoke: overrides.revoke ?? vi.fn(async () => undefined),
    signIn: overrides.signIn ?? vi.fn(async () => ACCOUNT),
    signUp:
      overrides.signUp ??
      vi.fn(async () => ({
        requiresEmailConfirmation: false as const,
        session: ACCOUNT,
        user: USER,
      })),
  }
  const codec = new SessionCookieCodec(SECRET)
  const app = createAuthRoutes({ accounts, codec })

  return { accounts, app, codec }
}

function createJsonRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`https://api.cronping.test${path}`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
    method: 'POST',
  })
}

describe('account HTTP routes', () => {
  it('creates a confirmed account session with a hardened encrypted cookie', async () => {
    const { app } = createRoutes()
    const response = await app.request(
      createJsonRequest('/api/auth/signup', {
        email: ' Alice@Example.TEST ',
        password: 'correct horse battery staple',
      }),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      data: {
        requiresEmailConfirmation: false,
        user: USER,
      },
    })
    const cookie = response.headers.get('set-cookie')

    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Max-Age=2592000')
  })

  it('does not establish a session while email confirmation is pending', async () => {
    const { app } = createRoutes({
      signUp: async () => ({
        requiresEmailConfirmation: true,
        user: USER,
      }),
    })
    const response = await app.request(
      createJsonRequest('/api/auth/signup', {
        email: USER.email,
        password: 'correct horse battery staple',
      }),
    )

    expect(response.status).toBe(202)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('returns a generic response for invalid credentials', async () => {
    const { app } = createRoutes({
      signIn: async () => {
        throw new InvalidCredentialsError()
      },
    })
    const response = await app.request(
      createJsonRequest('/api/auth/login', {
        email: USER.email,
        password: 'wrong password',
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'invalid_credentials',
        message: 'Invalid email or password',
      },
    })
  })

  it('logs in without exposing Supabase tokens in the response', async () => {
    const { app } = createRoutes()
    const response = await app.request(
      createJsonRequest('/api/auth/login', {
        email: USER.email,
        password: 'correct horse battery staple',
      }),
    )
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).not.toContain(TOKENS.accessToken)
    expect(body).not.toContain(TOKENS.refreshToken)
    expect(response.headers.get('set-cookie')).toContain(
      `${SESSION_COOKIE_NAME}=`,
    )
  })

  it('maps unexpected login and signup failures to a generic 500', async () => {
    const loginApp = createRoutes({
      signIn: async () => {
        throw new Error('provider internals')
      },
    }).app
    const loginResponse = await loginApp.request(
      createJsonRequest('/api/auth/login', {
        email: USER.email,
        password: 'correct horse battery staple',
      }),
    )

    expect(loginResponse.status).toBe(500)
    await expect(loginResponse.json()).resolves.toEqual({
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
      },
    })

    const signupApp = createRoutes({
      signUp: async () => {
        throw new Error('provider internals')
      },
    }).app
    const signupResponse = await signupApp.request(
      createJsonRequest('/api/auth/signup', {
        email: USER.email,
        password: 'correct horse battery staple',
      }),
    )

    expect(signupResponse.status).toBe(500)
  })

  it('masks account creation failures', async () => {
    const { app } = createRoutes({
      signUp: async () => {
        throw new AccountCreationError()
      },
    })
    const response = await app.request(
      createJsonRequest('/api/auth/signup', {
        email: USER.email,
        password: 'correct horse battery staple',
      }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'account_creation_failed',
        message: 'Account could not be created',
      },
    })
  })

  it('requires a valid encrypted session for the current account', async () => {
    const { app } = createRoutes()
    const response = await app.request('https://api.cronping.test/api/auth/me')

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authentication required',
      },
    })
  })

  it('returns the current account and rotates the cookie after refresh', async () => {
    const refreshedAccount = { ...ACCOUNT, refreshed: true }
    const { app, codec } = createRoutes({
      authenticate: async () => refreshedAccount,
    })
    const cookie = await encodeSessionCookie(codec, TOKENS)
    const response = await app.request(
      'https://api.cronping.test/api/auth/me',
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
      },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { tenantId: TENANT_ID, user: USER },
    })
    expect(response.headers.get('set-cookie')).toContain(
      `${SESSION_COOKIE_NAME}=`,
    )
  })

  it('does not rewrite a cookie when the session did not refresh', async () => {
    const { app, codec } = createRoutes()
    const cookie = await encodeSessionCookie(codec, TOKENS)
    const response = await app.request(
      'https://api.cronping.test/api/auth/me',
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('clears an invalid session cookie without leaking token details', async () => {
    const { app, codec } = createRoutes({
      authenticate: async () => null,
    })
    const cookie = await encodeSessionCookie(codec, TOKENS)
    const response = await app.request(
      'https://api.cronping.test/api/auth/me',
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
      },
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('clears malformed session cookies', async () => {
    const { app } = createRoutes()
    const response = await app.request(
      'https://api.cronping.test/api/auth/me',
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=not-encrypted` },
      },
    )

    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('revokes and clears the current session on logout', async () => {
    const revoke = vi.fn(async () => undefined)
    const { app, codec } = createRoutes({ revoke })
    const cookie = await encodeSessionCookie(codec, TOKENS)
    const response = await app.request(
      'https://api.cronping.test/api/auth/logout',
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
        method: 'POST',
      },
    )

    expect(response.status).toBe(204)
    expect(revoke).toHaveBeenCalledWith(TOKENS)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('clears logout cookies even when no session is present', async () => {
    const { accounts, app } = createRoutes()
    const response = await app.request(
      'https://api.cronping.test/api/auth/logout',
      { method: 'POST' },
    )

    expect(response.status).toBe(204)
    expect(accounts.revoke).not.toHaveBeenCalled()
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('rejects malformed JSON', async () => {
    const { app } = createRoutes()
    const response = await app.request('/api/auth/login', {
      body: '{invalid',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    expect(response.status).toBe(400)
  })

  it('rejects malformed and over-permissive credentials', async () => {
    const { app } = createRoutes()
    const response = await app.request(
      createJsonRequest('/api/auth/login', {
        email: 'not-an-email',
        password: 'password',
        tenantId: TENANT_ID,
      }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    })
  })
})
