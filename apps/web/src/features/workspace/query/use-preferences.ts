import { useQuery } from '@tanstack/react-query'

import { setDisplayTimeZone } from '../../../lib/display-time.ts'
import { getPreferences } from '../api/workspace-api.ts'

export const PREFERENCES_QUERY_KEY = ['preferences'] as const

export function usePreferences() {
  return useQuery({
    queryFn: async () => {
      const preferences = await getPreferences()

      setDisplayTimeZone(preferences.timezone)

      return preferences
    },
    queryKey: PREFERENCES_QUERY_KEY,
    staleTime: 5 * 60_000,
  })
}
