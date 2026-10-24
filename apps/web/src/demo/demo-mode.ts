const DEMO_STORAGE_KEY = 'cronping.demo-mode'

export function isDemoModeEnabled(): boolean {
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    return false
  }

  const url = new URL(window.location.href)

  if (url.searchParams.get('demo') === '1') {
    window.sessionStorage.setItem(DEMO_STORAGE_KEY, '1')
    return true
  }

  return window.sessionStorage.getItem(DEMO_STORAGE_KEY) === '1'
}

export function enableDemoMode(): void {
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    return
  }

  window.sessionStorage.setItem(DEMO_STORAGE_KEY, '1')
}

export function disableDemoMode(): void {
  window.sessionStorage.removeItem(DEMO_STORAGE_KEY)
}
