import type {
  MonitorTokenRotationInput,
  MonitorTokenRotationPort,
} from '../../application/rotate-monitor-token.ts'

type RotationRpcResult = PromiseLike<
  Readonly<{
    data: boolean | null
    error: Readonly<{ message: string }> | null
  }>
>

export type MonitorTokenRotationRpcClient = Readonly<{
  rpc(
    functionName: 'rotate_monitor_token',
    args: Readonly<{
      p_monitor_id: string
      p_token_hash: string
      p_token_prefix: string
    }>,
  ): RotationRpcResult
}>

export class SupabaseMonitorTokenRotation implements MonitorTokenRotationPort {
  constructor(private readonly client: MonitorTokenRotationRpcClient) {}

  async rotate(input: MonitorTokenRotationInput): Promise<boolean> {
    const { data, error } = await this.client.rpc('rotate_monitor_token', {
      p_monitor_id: input.monitorId,
      p_token_hash: input.tokenHash,
      p_token_prefix: input.tokenPrefix,
    })

    if (error) {
      throw new Error('monitor token rotation failed')
    }

    return data === true
  }
}
