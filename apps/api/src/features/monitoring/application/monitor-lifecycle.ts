export interface MonitorLifecyclePort {
  delete(monitorId: string): Promise<boolean>
  pause(monitorId: string): Promise<boolean>
  resume(monitorId: string): Promise<boolean>
}

export class MonitorLifecycle {
  constructor(private readonly port: MonitorLifecyclePort) {}

  async pause(monitorId: string): Promise<boolean> {
    return this.port.pause(monitorId)
  }

  async resume(monitorId: string): Promise<boolean> {
    return this.port.resume(monitorId)
  }

  async delete(monitorId: string): Promise<boolean> {
    return this.port.delete(monitorId)
  }
}
