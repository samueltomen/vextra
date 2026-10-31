import { useQuery } from '@tanstack/react-query'

import {
  setDisplayTimeFormat,
  setDisplayTimeZone,
} from '../../../lib/display-time.ts'
import { getPreferences } from '../api/workspace-api.ts'

export function applyDisplayPreferences(
  preferences: Readonly<{
    density: 'comfortable' | 'compact'
    timeFormat: '12h' | '24h'
    timezone: string
  }>,
): void {
  setDisplayTimeZone(preferences.timezone)
  setDisplayTimeFormat(preferences.timeFormat)
  document.documentElement.dataset['density'] = preferences.density
}

export const PREFERENCES_QUERY_KEY = ['preferences'] as const

export function usePreferences() {
  return useQuery({
    queryFn: async () => {
      const preferences = await getPreferences()

      applyDisplayPreferences(preferences)

      return preferences
    },
    queryKey: PREFERENCES_QUERY_KEY,
    staleTime: 5 * 60_000,
  })
}
