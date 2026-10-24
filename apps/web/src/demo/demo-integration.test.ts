import { describe, expect, it } from 'vitest'

import {
  getCurrentAccount,
  signIn,
  signOut,
  signUp,
} from '../features/accounts/api/account-api.ts'
import {
  createMonitor,
  deleteMonitor,
  getMonitor,
  listMonitorIncidents,
  listMonitors,
  pauseMonitor,
  resumeMonitor,
  rotateMonitorToken,
} from '../features/monitoring/api/monitoring-api.ts'
import { DEMO_ACCOUNT } from './demo-account.ts'
import { enableDemoMode, isDemoModeEnabled } from './demo-mode.ts'

describe('demo data adapters', () => {
  it('supports the full UX without fetch or Supabase', async () => {
    enableDemoMode()

    await expect(getCurrentAccount()).resolves.toEqual(DEMO_ACCOUNT)
    await expect(
      signIn({ email: 'demo@cronping.local', password: 'unused' }),
    ).resolves.toEqual(DEMO_ACCOUNT)
    await expect(
      signUp({ email: 'demo@cronping.local', password: 'unused' }),
    ).resolves.toEqual({
      requiresEmailConfirmation: false,
      user: DEMO_ACCOUNT.user,
    })

    const monitors = await listMonitors()
    const lateMonitor = monitors.find((monitor) => monitor.status === 'late')

    expect(monitors).toHaveLength(4)
    expect(lateMonitor).toBeDefined()
    await expect(getMonitor(lateMonitor!.id)).resolves.toMatchObject({
      status: 'late',
    })
    await expect(listMonitorIncidents(lateMonitor!.id)).resolves.toHaveLength(2)

    await pauseMonitor(lateMonitor!.id)
    await expect(getMonitor(lateMonitor!.id)).resolves.toMatchObject({
      status: 'paused',
    })
    await resumeMonitor(lateMonitor!.id)
    await expect(getMonitor(lateMonitor!.id)).resolves.toMatchObject({
      status: 'healthy',
    })

    await expect(rotateMonitorToken(lateMonitor!.id)).resolves.toMatch(
      /^cp_demo_/u,
    )
    await expect(
      rotateMonitorToken('20000000-0000-4000-8000-999999999999'),
    ).rejects.toThrow('Monitor not found')

    const created = await createMonitor({
      graceMinutes: 2,
      intervalMinutes: 5,
      localLabel: 'Demo cleanup',
    })
    expect(created.monitor.localLabel).toBe('Demo cleanup')
    await deleteMonitor(created.monitor.id)
    await expect(getMonitor(created.monitor.id)).resolves.toBeNull()

    await signOut()
    expect(isDemoModeEnabled()).toBe(false)
  })
})
