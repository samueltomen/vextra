import type {
  AuthenticatedSessionResponse,
  SignUpResponse,
} from '@vextra/contracts'

import { ApiError, apiRequest } from '../../../api/client.ts'
import { DEMO_ACCOUNT } from '../../../demo/demo-account.ts'
import { disableDemoMode, isDemoModeEnabled } from '../../../demo/demo-mode.ts'
import type { CurrentAccount } from '../model/account.ts'

export type SignInInput = Readonly<{
  email: string
  password: string
}>

export type SignUpResult = Readonly<{
  requiresEmailConfirmation: boolean
  user: CurrentAccount['user']
}>

export async function getCurrentAccount(): Promise<CurrentAccount | null> {
  if (isDemoModeEnabled()) {
    return DEMO_ACCOUNT
  }

  try {
    const response =
      await apiRequest<AuthenticatedSessionResponse>('/api/auth/me')

    return response.data
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }

    throw error
  }
}

export async function signIn(input: SignInInput): Promise<CurrentAccount> {
  if (isDemoModeEnabled()) {
    return DEMO_ACCOUNT
  }

  const response = await apiRequest<AuthenticatedSessionResponse>(
    '/api/auth/login',
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
  )

  return response.data
}

export async function signUp(input: SignInInput): Promise<SignUpResult> {
  if (isDemoModeEnabled()) {
    return {
      requiresEmailConfirmation: false,
      user: DEMO_ACCOUNT.user,
    }
  }

  const response = await apiRequest<SignUpResponse>('/api/auth/signup', {
    body: JSON.stringify(input),
    method: 'POST',
  })

  return response.data
}

export async function signOut(): Promise<void> {
  if (isDemoModeEnabled()) {
    disableDemoMode()
    return
  }

  await apiRequest<void>('/api/auth/logout', { method: 'POST' })
}

export async function deleteAccount(): Promise<void> {
  if (isDemoModeEnabled()) {
    disableDemoMode()
    return
  }

  await apiRequest<void>('/api/account', { method: 'DELETE' })
}
