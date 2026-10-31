import { describe, expect, it, vi } from 'vitest'

import { UpdateMonitorSchedule } from './update-monitor-schedule.ts'

const NOW = Date.parse('2026-10-31T12:00:00.000Z')
const INPUT = {
  graceSeconds: 120,
  intervalSeconds: 900,
  monitorId: '20000000-0000-4000-8000-000000000001',
} as const

function setup(result = true) {
  const update = vi.fn(async () => result)

  return {
    update,
    useCase: new UpdateMonitorSchedule({ nowMs: () => NOW, port: { update } }),
  }
}

describe('UpdateMonitorSchedule', () => {
  it('delegates an interval schedule to the port and reports whether it applied', async () => {
    const { update, useCase } = setup()

    await expect(useCase.execute(INPUT)).resolves.toBe(true)
    expect(update).toHaveBeenCalledWith({ ...INPUT, cron: null })
  })

  it('reports a monitor that is not visible to the caller', async () => {
    await expect(setup(false).useCase.execute(INPUT)).resolves.toBe(false)
  })

  it('derives the interval from the longest gap of a cron schedule', async () => {
    const { update, useCase } = setup()

    await useCase.execute({
      cron: { expression: '0 3 * * *', timezone: 'UTC' },
      graceSeconds: 300,
      monitorId: INPUT.monitorId,
    })

    expect(update).toHaveBeenCalledWith({
      cron: { expression: '0 3 * * *', timezone: 'UTC' },
      graceSeconds: 300,
      intervalSeconds: 86_400 + 3_600,
      monitorId: INPUT.monitorId,
    })
  })

  it('rejects a schedule that breaks the domain rules before reaching the port', async () => {
    const { update, useCase } = setup()

    await expect(
      useCase.execute({ ...INPUT, intervalSeconds: 30 }),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(
      useCase.execute({ ...INPUT, graceSeconds: -1 }),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(
      useCase.execute({ graceSeconds: 10, monitorId: INPUT.monitorId }),
    ).rejects.toBeInstanceOf(RangeError)
    expect(update).not.toHaveBeenCalled()
  })
})
