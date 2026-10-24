import { describe, expect, it } from 'vitest'

import {
  disableDemoMode,
  enableDemoMode,
  isDemoModeEnabled,
} from './demo-mode.ts'

describe('demo mode', () => {
  it('is enabled by the query parameter and persists across navigation', () => {
    window.history.replaceState({}, '', '/?demo=1')

    expect(isDemoModeEnabled()).toBe(true)
    window.history.replaceState({}, '', '/monitors/new')
    expect(isDemoModeEnabled()).toBe(true)
  })

  it('can be enabled and disabled explicitly', () => {
    enableDemoMode()
    expect(isDemoModeEnabled()).toBe(true)
    disableDemoMode()
    expect(isDemoModeEnabled()).toBe(false)
  })
})
