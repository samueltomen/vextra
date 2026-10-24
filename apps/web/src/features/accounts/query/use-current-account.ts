import { useQuery } from '@tanstack/react-query'

import { getCurrentAccount } from '../api/account-api.ts'

export const CURRENT_ACCOUNT_QUERY_KEY = ['auth', 'me'] as const

export function useCurrentAccount() {
  return useQuery({
    queryFn: getCurrentAccount,
    queryKey: CURRENT_ACCOUNT_QUERY_KEY,
    retry: false,
    staleTime: 60_000,
  })
}
