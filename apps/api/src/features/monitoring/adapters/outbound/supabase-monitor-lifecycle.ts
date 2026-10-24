import type { MonitorLifecyclePort } from '../../application/monitor-lifecycle.ts'

type LifecycleRpcResult = PromiseLike<
  Readonly<{
    data: boolean | null
    error: Readonly<{ message: string }> | null
  }>
>

export type MonitorLifecycleRpcClient = Readonly<{
  rpc(
    functionName: 'delete_monitor' | 'pause_monitor' | 'resume_monitor',
    args: Readonly<{ p_monitor_id: string }>,
  ): LifecycleRpcResult
}>

export class SupabaseMonitorLifecycle implements MonitorLifecyclePort {
  constructor(private readonly client: MonitorLifecycleRpcClient) {}

  async pause(monitorId: string): Promise<boolean> {
    return this.execute('pause_monitor', monitorId)
  }

  async resume(monitorId: string): Promise<boolean> {
    return this.execute('resume_monitor', monitorId)
  }

  async delete(monitorId: string): Promise<boolean> {
    return this.execute('delete_monitor', monitorId)
  }

  private async execute(
    functionName: 'delete_monitor' | 'pause_monitor' | 'resume_monitor',
    monitorId: string,
  ): Promise<boolean> {
    const { data, error } = await this.client.rpc(functionName, {
      p_monitor_id: monitorId,
    })

    if (error) {
      throw new Error('monitor lifecycle failed')
    }

    return data === true
  }
}
