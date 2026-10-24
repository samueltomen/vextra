import { signInRequestSchema, signUpRequestSchema } from '@cronping/contracts'
import { Hono, type Context } from 'hono'

import {
  AccountCreationError,
  InvalidCredentialsError,
  type AccountService,
  type AuthenticatedAccount,
} from '../../../application/account-service.ts'
import type { SessionCookieCodec } from '../../outbound/session-cookie.ts'
import {
  clearSessionCookie,
  hasSessionCookie,
  readSessionCookie,
  writeSessionCookie,
} from './session-cookies.ts'

type AuthRoutesAccounts = Pick<
  AccountService,
  'authenticate' | 'revoke' | 'signIn' | 'signUp'
>

export type AuthRoutesDependencies = Readonly<{
  accounts: AuthRoutesAccounts
  codec: SessionCookieCodec
}>

function invalidJson(context: Context) {
  return context.json(
    {
      error: {
        code: 'invalid_json',
        message: 'Request body must be valid JSON',
      },
    },
    400,
  )
}

function unauthorized(context: Context) {
  return context.json(
    {
      error: {
        code: 'unauthorized',
        message: 'Authentication required',
      },
    },
    401,
  )
}

function internalError(context: Context) {
  return context.json(
    {
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
      },
    },
    500,
  )
}

function validationError(context: Context, issues: ReadonlyArray<unknown>) {
  return context.json(
    {
      error: {
        code: 'validation_error',
        details: issues,
        message: 'Request validation failed',
      },
    },
    422,
  )
}

async function readJson(context: Context): Promise<
  | { ok: true; value: unknown }
  | {
      ok: false
      response: ReturnType<typeof invalidJson>
    }
> {
  try {
    return { ok: true, value: await context.req.json() }
  } catch {
    return { ok: false, response: invalidJson(context) }
  }
}

function sessionResponse(account: AuthenticatedAccount) {
  return {
    data: {
      tenantId: account.tenantId,
      user: account.user,
    },
  }
}

export function createAuthRoutes(dependencies: AuthRoutesDependencies): Hono {
  const routes = new Hono()

  routes.post('/api/auth/signup', async (context) => {
    const body = await readJson(context)

    if (!body.ok) {
      return body.response
    }

    const parsed = signUpRequestSchema.safeParse(body.value)

    if (!parsed.success) {
      return validationError(context, parsed.error.issues)
    }

    try {
      const result = await dependencies.accounts.signUp(parsed.data)

      if (result.requiresEmailConfirmation) {
        return context.json(
          {
            data: {
              requiresEmailConfirmation: true,
              user: result.user,
            },
          },
          202,
        )
      }

      await writeSessionCookie(
        context,
        dependencies.codec,
        result.session.tokens,
      )

      return context.json(
        {
          data: {
            requiresEmailConfirmation: false,
            user: result.user,
          },
        },
        201,
      )
    } catch (error) {
      if (error instanceof AccountCreationError) {
        return context.json(
          {
            error: {
              code: 'account_creation_failed',
              message: 'Account could not be created',
            },
          },
          422,
        )
      }

      return internalError(context)
    }
  })

  routes.post('/api/auth/login', async (context) => {
    const body = await readJson(context)

    if (!body.ok) {
      return body.response
    }

    const parsed = signInRequestSchema.safeParse(body.value)

    if (!parsed.success) {
      return validationError(context, parsed.error.issues)
    }

    try {
      const account = await dependencies.accounts.signIn(parsed.data)

      await writeSessionCookie(context, dependencies.codec, account.tokens)

      return context.json(sessionResponse(account), 200)
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return context.json(
          {
            error: {
              code: 'invalid_credentials',
              message: 'Invalid email or password',
            },
          },
          401,
        )
      }

      return internalError(context)
    }
  })

  routes.get('/api/auth/me', async (context) => {
    const tokens = await readSessionCookie(context, dependencies.codec)

    if (!tokens) {
      if (hasSessionCookie(context)) {
        clearSessionCookie(context)
      }

      return unauthorized(context)
    }

    const account = await dependencies.accounts.authenticate(tokens)

    if (!account) {
      clearSessionCookie(context)
      return unauthorized(context)
    }

    if (account.refreshed) {
      await writeSessionCookie(context, dependencies.codec, account.tokens)
    }

    return context.json(sessionResponse(account), 200)
  })

  routes.post('/api/auth/logout', async (context) => {
    const tokens = await readSessionCookie(context, dependencies.codec)

    if (tokens) {
      await dependencies.accounts.revoke(tokens)
    }

    clearSessionCookie(context)
    return context.body(null, 204)
  })

  return routes
}
