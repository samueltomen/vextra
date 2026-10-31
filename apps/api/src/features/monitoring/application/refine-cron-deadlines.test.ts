import { describe, expect, it, vi } from 'vitest'

import {
  RefineCronDeadlines,
  type CronDeadlinePort,
  type StaleCronMonitor,
} from './refine-cron-deadlines.ts'

const NOW = Date.parse('2026-10-31T12:00:00.000Z')

function monitor(overrides: Partial<StaleCronMonitor> = {}): StaleCronMonitor {
  return {
    cronExpression: '0 3 * * *',
    cronTimezone: 'UTC',
    graceSeconds: 300,
    lastHeartbeatAt: '2026-10-31T03:00:20.123456+00:00',
    monitorId: 'm1',
    ...overrides,
  }
}

function setup(
  monitors: readonly StaleCronMonitor[],
  apply: CronDeadlinePort['apply'] = async () => true,
) {
  const port = {
    apply: vi.fn(apply),
    claim: vi.fn(async () => monitors),
  } satisfies CronDeadlinePort

  return {
    port,
    useCase: new RefineCronDeadlines({ nowMs: () => NOW, port }),
  }
}

describe('RefineCronDeadlines', () => {
  it('sets the deadline to the next occurrence after the heartbeat plus the grace', async () => {
    const { port, useCase } = setup([monitor()])

    await expect(useCase.execute()).resolves.toEqual({
      applied: 1,
      skipped: 0,
    })
    expect(port.apply).toHaveBeenCalledWith({
      alertAtMs: Date.parse('2026-11-01T03:05:00.000Z'),
      expectedHeartbeatAt: '2026-10-31T03:00:20.123456+00:00',
      monitorId: 'm1',
    })
  })

  it('honors the time zone of the schedule', async () => {
    const { port, useCase } = setup([
      monitor({ cronTimezone: 'Europe/Paris', graceSeconds: 0 }),
    ])

    await useCase.execute()

    // 03:00 in Paris is 02:00 UTC in November.
    expect(port.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        alertAtMs: Date.parse('2026-11-01T02:00:00.000Z'),
      }),
    )
  })

  it('counts from now when the monitor never received a heartbeat', async () => {
    const { port, useCase } = setup([monitor({ lastHeartbeatAt: null })])

    await useCase.execute()

    expect(port.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        alertAtMs: Date.parse('2026-11-01T03:05:00.000Z'),
        expectedHeartbeatAt: null,
      }),
    )
  })

  it('never sets a deadline in the past when a run was already missed', async () => {
    const { port, useCase } = setup([
      monitor({ lastHeartbeatAt: '2026-10-28T03:00:00+00:00' }),
    ])

    await useCase.execute()

    expect(port.apply).toHaveBeenCalledWith(
      expect.objectContaining({ alertAtMs: NOW }),
    )
  })

  it('skips impossible schedules, invalid stored values and raced updates', async () => {
    const { useCase } = setup(
      [
        monitor({ cronExpression: '0 0 31 2 *', monitorId: 'never' }),
        monitor({ cronExpression: 'not cron', monitorId: 'broken' }),
        monitor({ monitorId: 'raced' }),
      ],
      async ({ monitorId }) => monitorId !== 'raced',
    )

    await expect(useCase.execute()).resolves.toEqual({
      applied: 0,
      skipped: 3,
    })
  })

  it('keeps going when one monitor fails to update', async () => {
    const { useCase } = setup(
      [monitor({ monitorId: 'down' }), monitor({ monitorId: 'ok' })],
      async ({ monitorId }) => {
        if (monitorId === 'down') {
          throw new Error('db')
        }

        return true
      },
    )

    await expect(useCase.execute()).resolves.toEqual({
      applied: 1,
      skipped: 1,
    })
  })
})
