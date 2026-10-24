const MAX_BATCH_SIZE = 1_000

export interface DueMonitorClaimer {
  claimDue(batchSize: number): Promise<number>
}

export class CheckDueMonitors {
  constructor(private readonly dependencies: Readonly<{ claimer: DueMonitorClaimer }>) {}

  async execute(batchSize = 100): Promise<number> {
    if (
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > MAX_BATCH_SIZE
    ) {
      throw new RangeError(
        `batch size must be an integer between 1 and ${MAX_BATCH_SIZE}`,
      )
    }

    return this.dependencies.claimer.claimDue(batchSize)
  }
}
