import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// The full suite runs many jsdom workers in parallel: 1 s is too tight.
configure({ asyncUtilTimeout: 4_000 })

Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  value: vi.fn(),
  writable: true,
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
})
