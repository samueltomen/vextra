import type { DueMonitorClaimer } from '../../application/check-due-monitors.ts'

type CheckRpcResult = PromiseLike<
  Readonly<{
    data: number | null
    error: Readonly<{ message: string }> | null
  }>
>

export type DueMonitorRpcClient = Readonly<{
  rpc(
    functionName: 'open_due_monitor_incidents',
    args: Readonly<{ p_batch_size: number }>,
  ): CheckRpcResult
}>

export class SupabaseDueMonitorClaimer implements DueMonitorClaimer {
  constructor(private readonly client: DueMonitorRpcClient) {}

  async claimDue(batchSize: number): Promise<number> {
    const { data, error } = await this.client.rpc(
      'open_due_monitor_incidents',
      {
        p_batch_size: batchSize,
      },
    )

    if (error || typeof data !== 'number') {
      throw new Error('due monitor check failed')
    }

    return data
  }
}
