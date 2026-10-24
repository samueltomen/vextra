import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import type { SessionTokens } from '../../../application/account-service.ts'
import type { SessionCookieCodec } from '../../outbound/session-cookie.ts'

export const SESSION_COOKIE_NAME = '__Host-cronping_session' as const
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  path: '/',
  priority: 'high',
  sameSite: 'Strict',
  secure: true,
} as const

export async function encodeSessionCookie(
  codec: SessionCookieCodec,
  tokens: SessionTokens,
): Promise<string> {
  return codec.encode(tokens)
}

export async function readSessionCookie(
  context: Context,
  codec: SessionCookieCodec,
): Promise<SessionTokens | null> {
  const value = getCookie(context, SESSION_COOKIE_NAME)

  return value ? codec.decode(value) : null
}

export async function writeSessionCookie(
  context: Context,
  codec: SessionCookieCodec,
  tokens: SessionTokens,
): Promise<void> {
  const value = await encodeSessionCookie(codec, tokens)

  setCookie(context, SESSION_COOKIE_NAME, value, SESSION_COOKIE_OPTIONS)
}

export function clearSessionCookie(context: Context): void {
  deleteCookie(context, SESSION_COOKIE_NAME, {
    path: '/',
    sameSite: 'Strict',
    secure: true,
  })
}

export function hasSessionCookie(context: Context): boolean {
  return getCookie(context, SESSION_COOKIE_NAME) !== undefined
}
