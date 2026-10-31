import { describe, expect, it, vi } from 'vitest'

import { ManageMaintenance } from './maintenance.ts'

describe('ManageMaintenance', () => {
  it('delegates to the port with the tenant', async () => {
    const port = {
      create: vi.fn(async () => ({ id: 'w' }) as never),
      list: vi.fn(async () => []),
      remove: vi.fn(async () => true),
    }
    const useCase = new ManageMaintenance(port)

    await useCase.list('t1')
    await useCase.create('t1', {} as never)
    await useCase.remove('t1', 'w')
    expect(port.list).toHaveBeenCalledWith('t1')
    expect(port.create).toHaveBeenCalledWith('t1', {})
    expect(port.remove).toHaveBeenCalledWith('t1', 'w')
  })
})
