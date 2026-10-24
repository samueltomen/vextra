import type { SupabaseClient } from '@supabase/supabase-js'

import type { AccountDeletionPort } from '../../application/delete-account.ts'

export class SupabaseAccountDeletion implements AccountDeletionPort {
  constructor(private readonly client: SupabaseClient) {}

  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(userId)

    if (error) {
      throw new Error('account deletion failed')
    }
  }
}
