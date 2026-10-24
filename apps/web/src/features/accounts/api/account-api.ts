import type {
  AuthenticatedSessionResponse,
  SignUpResponse,
} from '@cronping/contracts'

import { ApiError, apiRequest } from '../../../api/client.ts'
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
  const response = await apiRequest<SignUpResponse>('/api/auth/signup', {
    body: JSON.stringify(input),
    method: 'POST',
  })

  return response.data
}

export async function signOut(): Promise<void> {
  await apiRequest<void>('/api/auth/logout', { method: 'POST' })
}
