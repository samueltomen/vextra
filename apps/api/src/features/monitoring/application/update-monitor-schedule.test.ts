import { describe, expect, it, vi } from 'vitest'

import { UpdateMonitorSchedule } from './update-monitor-schedule.ts'

const INPUT = {
  graceSeconds: 120,
  intervalSeconds: 900,
  monitorId: '20000000-0000-4000-8000-000000000001',
} as const

describe('UpdateMonitorSchedule', () => {
  it('delegates a valid schedule to the port and reports whether it applied', async () => {
    const update = vi.fn(async () => true)
    const useCase = new UpdateMonitorSchedule({ update })

    await expect(useCase.execute(INPUT)).resolves.toBe(true)
    expect(update).toHaveBeenCalledWith(INPUT)

    update.mockResolvedValueOnce(false)
    await expect(useCase.execute(INPUT)).resolves.toBe(false)
  })

  it('rejects a schedule that breaks the domain rules before reaching the port', async () => {
    const update = vi.fn(async () => true)
    const useCase = new UpdateMonitorSchedule({ update })

    await expect(
      useCase.execute({ ...INPUT, intervalSeconds: 30 }),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(
      useCase.execute({ ...INPUT, graceSeconds: -1 }),
    ).rejects.toBeInstanceOf(RangeError)
    expect(update).not.toHaveBeenCalled()
  })
})
