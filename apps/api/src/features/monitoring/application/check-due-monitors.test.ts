import { describe, expect, it, vi } from 'vitest'

import {
  CheckDueMonitors,
  type DueMonitorClaimer,
} from './check-due-monitors.ts'

describe('CheckDueMonitors', () => {
  it('opens due incidents through one bounded atomic claim', async () => {
    const claimer: DueMonitorClaimer = {
      claimDue: vi.fn(async () => 3),
    }
    const checker = new CheckDueMonitors({ claimer })

    await expect(checker.execute(100)).resolves.toBe(3)
    expect(claimer.claimDue).toHaveBeenCalledWith(100)
  })

  it.each([0, -1, 1.5, 1_001])(
    'rejects an unsafe batch size: %s',
    async (batchSize) => {
      const claimer: DueMonitorClaimer = {
        claimDue: vi.fn(async () => 0),
      }
      const checker = new CheckDueMonitors({ claimer })

      await expect(checker.execute(batchSize)).rejects.toBeInstanceOf(
        RangeError,
      )
      expect(claimer.claimDue).not.toHaveBeenCalled()
    },
  )
})
