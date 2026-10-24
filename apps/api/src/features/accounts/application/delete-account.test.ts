import { describe, expect, it, vi } from 'vitest'

import { DeleteAccount, type AccountDeletionPort } from './delete-account.ts'

describe('DeleteAccount', () => {
  it('deletes only the authenticated user id', async () => {
    const port: AccountDeletionPort = {
      deleteUser: vi.fn(async () => undefined),
    }
    const deletion = new DeleteAccount(port)

    await expect(
      deletion.execute('00000000-0000-4000-8000-000000000001'),
    ).resolves.toBeUndefined()
    expect(port.deleteUser).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
    )
  })

  it('propagates provider failures', async () => {
    const deletion = new DeleteAccount({
      deleteUser: async () => {
        throw new Error('provider unavailable')
      },
    })

    await expect(
      deletion.execute('00000000-0000-4000-8000-000000000001'),
    ).rejects.toThrow('provider unavailable')
  })
})
