export interface HeartbeatRecorder {
  record(tokenHash: string): Promise<boolean>
}

export type RecordHeartbeatDependencies = Readonly<{
  hashToken: (token: string) => Promise<string>
  recorder: HeartbeatRecorder
}>

export class RecordHeartbeat {
  constructor(private readonly dependencies: RecordHeartbeatDependencies) {}

  async execute(token: string): Promise<boolean> {
    const tokenHash = await this.dependencies.hashToken(token)

    return this.dependencies.recorder.record(tokenHash)
  }
}
