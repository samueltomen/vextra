import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import { SupabaseAccountDeletion } from './supabase-account-deletion.ts'

describe('SupabaseAccountDeletion', () => {
  it('deletes the authenticated user through the admin API', async () => {
    const deleteUser = vi.fn(async () => ({ data: null, error: null }))
    const client = {
      auth: { admin: { deleteUser } },
    } as unknown as SupabaseClient
    const deletion = new SupabaseAccountDeletion(client)

    await expect(
      deletion.deleteUser('00000000-0000-4000-8000-000000000001'),
    ).resolves.toBeUndefined()
    expect(deleteUser).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
    )
  })

  it('rejects provider failures without leaking details', async () => {
    const deletion = new SupabaseAccountDeletion({
      auth: {
        admin: {
          deleteUser: async () => ({
            data: null,
            error: { message: 'provider detail' },
          }),
        },
      },
    } as unknown as SupabaseClient)

    await expect(
      deletion.deleteUser('00000000-0000-4000-8000-000000000001'),
    ).rejects.toThrow('account deletion failed')
  })
})
