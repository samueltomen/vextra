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

export type RunEventKind = 'fail' | 'start' | 'warn'

export interface RunEventRecorder {
  record(tokenHash: string, kind: RunEventKind): Promise<boolean>
}

export type RecordRunEventDependencies = Readonly<{
  hashToken: (token: string) => Promise<string>
  recorder: RunEventRecorder
}>

export class RecordRunEvent {
  constructor(private readonly dependencies: RecordRunEventDependencies) {}

  async execute(token: string, kind: RunEventKind): Promise<boolean> {
    const tokenHash = await this.dependencies.hashToken(token)

    return this.dependencies.recorder.record(tokenHash, kind)
  }
}
