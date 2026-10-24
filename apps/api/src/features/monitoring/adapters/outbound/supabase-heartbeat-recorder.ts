import type { HeartbeatRecorder } from '../../application/record-heartbeat.ts'

type HeartbeatRpcResult = PromiseLike<
  Readonly<{
    data: boolean | null
    error: Readonly<{ message: string }> | null
  }>
>

export type HeartbeatRpcClient = Readonly<{
  rpc(
    functionName: 'record_heartbeat',
    args: Readonly<{ p_token_hash: string }>,
  ): HeartbeatRpcResult
}>

export class SupabaseHeartbeatRecorder implements HeartbeatRecorder {
  constructor(private readonly client: HeartbeatRpcClient) {}

  async record(tokenHash: string): Promise<boolean> {
    const { data, error } = await this.client.rpc('record_heartbeat', {
      p_token_hash: tokenHash,
    })

    if (error) {
      throw new Error('heartbeat persistence failed')
    }

    return data === true
  }
}
