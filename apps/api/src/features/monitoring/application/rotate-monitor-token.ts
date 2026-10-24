export type MonitorTokenRotationInput = Readonly<{
  monitorId: string
  tokenHash: string
  tokenPrefix: string
}>

export interface MonitorTokenRotationPort {
  rotate(input: MonitorTokenRotationInput): Promise<boolean>
}

export class RotateMonitorToken {
  constructor(
    private readonly dependencies: Readonly<{
      generator: Readonly<{
        generate(): Promise<{
          hash: string
          prefix: string
          token: string
        }>
      }>
      port: MonitorTokenRotationPort
    }>,
  ) {}

  async execute(monitorId: string): Promise<string | null> {
    const credential = await this.dependencies.generator.generate()
    const rotated = await this.dependencies.port.rotate({
      monitorId,
      tokenHash: credential.hash,
      tokenPrefix: credential.prefix,
    })

    return rotated ? credential.token : null
  }
}
