import { describe, expect, it, vi } from 'vitest'

import {
  CreateMonitor,
  type MonitorRepositoryPort,
  type NewMonitorRecord,
} from './create-monitor.ts'

function createDependencies() {
  const records: NewMonitorRecord[] = []
  const repository: MonitorRepositoryPort = {
    save: vi.fn(async (record: NewMonitorRecord) => {
      records.push(record)
    }),
  }

  return {
    clock: { nowMs: () => Date.parse('2026-01-01T00:00:00.000Z') },
    idGenerator: { generate: () => 'monitor-1' },
    records,
    repository,
    tokenGenerator: {
      generate: vi.fn(async () => ({
        hash: 'hashed-token',
        prefix: 'token-pr',
        token: 'raw-secret-token',
      })),
    },
  }
}

describe('CreateMonitor', () => {
  it('creates a monitor for the authenticated tenant', async () => {
    const dependencies = createDependencies()
    const createMonitor = new CreateMonitor(dependencies)

    const result = await createMonitor.execute({
      tenantId: 'tenant-a',
      intervalSeconds: 300,
      graceSeconds: 30,
    })

    expect(result.monitor).toMatchObject({
      id: 'monitor-1',
      tenantId: 'tenant-a',
      intervalSeconds: 300,
      graceSeconds: 30,
      status: 'pending',
    })
    expect(result.heartbeatToken).toBe('raw-secret-token')
  })

  it('persists only the heartbeat token hash and prefix', async () => {
    const dependencies = createDependencies()
    const createMonitor = new CreateMonitor(dependencies)

    await createMonitor.execute({
      tenantId: 'tenant-a',
      intervalSeconds: 300,
      graceSeconds: 30,
    })

    expect(dependencies.records).toHaveLength(1)
    expect(dependencies.records[0]).toMatchObject({
      heartbeatTokenHash: 'hashed-token',
      heartbeatTokenPrefix: 'token-pr',
    })
    expect(JSON.stringify(dependencies.records[0])).not.toContain(
      'raw-secret-token',
    )
  })

  it('rejects invalid scheduling before persisting', async () => {
    const dependencies = createDependencies()
    const createMonitor = new CreateMonitor(dependencies)

    await expect(
      createMonitor.execute({
        tenantId: 'tenant-a',
        intervalSeconds: 59,
        graceSeconds: 30,
      }),
    ).rejects.toThrow(RangeError)
    expect(dependencies.repository.save).not.toHaveBeenCalled()
    expect(dependencies.tokenGenerator.generate).not.toHaveBeenCalled()
  })
})
