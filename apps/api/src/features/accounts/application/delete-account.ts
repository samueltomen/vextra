export interface AccountDeletionPort {
  deleteUser(userId: string): Promise<void>
}

export class DeleteAccount {
  constructor(private readonly port: AccountDeletionPort) {}

  async execute(userId: string): Promise<void> {
    return this.port.deleteUser(userId)
  }
}
