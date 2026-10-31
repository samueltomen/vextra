export type ChannelKind =
  'discord' | 'pagerduty' | 'slack' | 'teams' | 'telegram' | 'webhook'

export type AlertEvent =
  'incident_opened' | 'incident_resolved' | 'reminder' | 'run_failed' | 'test'

export type ChannelRecord = Readonly<{
  createdAtMs: number
  enabled: boolean
  id: string
  kind: ChannelKind
  name: string
  targetHint: string
}>

export type ChannelAlert = Readonly<{
  appOrigin: string
  event: AlertEvent
  monitorId: string
  monitorName: string | null
  openedAtMs: number | null
}>

export class ChannelNameTakenError extends Error {
  constructor() {
    super('channel name already used')
    this.name = 'ChannelNameTakenError'
  }
}

export class ChannelLimitError extends Error {
  constructor() {
    super('channel limit reached')
    this.name = 'ChannelLimitError'
  }
}

export class InvalidChannelTargetError extends Error {
  constructor() {
    super('invalid channel target')
    this.name = 'InvalidChannelTargetError'
  }
}

export class ChannelDeliveryError extends Error {
  constructor() {
    super('channel delivery failed')
    this.name = 'ChannelDeliveryError'
  }
}

const BLOCKED_HOST_SUFFIXES = [
  '.local',
  '.internal',
  '.localhost',
  '.lan',
  '.home.arpa',
] as const

function parsePublicHttpsUrl(raw: string): URL {
  let url: URL

  try {
    url = new URL(raw)
  } catch {
    throw new InvalidChannelTargetError()
  }

  const host = url.hostname.toLowerCase()
  const isIpLiteral =
    /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host) || host.includes(':')

  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    (url.port !== '' && url.port !== '443') ||
    !host.includes('.') ||
    isIpLiteral ||
    host === 'localhost' ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    throw new InvalidChannelTargetError()
  }

  return url
}

function urlHint(url: URL): string {
  return `${url.hostname}/…${url.pathname.slice(-4)}`
}

const DISCORD_HOSTS = new Set([
  'discord.com',
  'discordapp.com',
  'canary.discord.com',
  'ptb.discord.com',
])

/**
 * Validates a channel target and returns the normalized secret plus a masked
 * hint that is safe to show. Rejects anything that is not a public HTTPS
 * endpoint so a channel can never be used to reach internal services.
 */
export function normalizeChannelTarget(
  kind: ChannelKind,
  raw: string,
): Readonly<{ hint: string; target: string }> {
  const value = raw.trim()

  if (kind === 'telegram') {
    const match =
      /^(\d{5,}:[A-Za-z0-9_-]{20,})\|(-?\d+|@[A-Za-z0-9_]{5,})$/u.exec(value)

    if (!match) {
      throw new InvalidChannelTargetError()
    }

    return { hint: `chat ${match[2]}`, target: value }
  }

  if (kind === 'pagerduty') {
    if (!/^[A-Za-z0-9]{32}$/u.test(value)) {
      throw new InvalidChannelTargetError()
    }

    return { hint: `clé …${value.slice(-4)}`, target: value }
  }

  const url = parsePublicHttpsUrl(value)

  if (
    kind === 'slack' &&
    !(
      url.hostname === 'hooks.slack.com' &&
      url.pathname.startsWith('/services/')
    )
  ) {
    throw new InvalidChannelTargetError()
  }

  if (
    kind === 'discord' &&
    !(
      DISCORD_HOSTS.has(url.hostname) &&
      url.pathname.startsWith('/api/webhooks/')
    )
  ) {
    throw new InvalidChannelTargetError()
  }

  return { hint: urlHint(url), target: url.toString() }
}

export interface ChannelPort {
  create(
    tenantId: string,
    input: Readonly<{
      kind: ChannelKind
      name: string
      target: string
      targetHint: string
    }>,
  ): Promise<ChannelRecord>
  list(tenantId: string): Promise<readonly ChannelRecord[]>
  remove(tenantId: string, channelId: string): Promise<boolean>
  setEnabled(
    tenantId: string,
    channelId: string,
    enabled: boolean,
  ): Promise<boolean>
}

export interface ChannelSecretPort {
  findTarget(
    tenantId: string,
    channelId: string,
  ): Promise<Readonly<{ kind: ChannelKind; target: string }> | null>
}

export interface ChannelSender {
  send(
    input: Readonly<{ alert: ChannelAlert; kind: ChannelKind; target: string }>,
  ): Promise<void>
}

export class ManageChannels {
  constructor(
    private readonly dependencies: Readonly<{
      appOrigin: string
      channels: ChannelPort
      secrets: ChannelSecretPort
      sender: ChannelSender
    }>,
  ) {}

  list(tenantId: string) {
    return this.dependencies.channels.list(tenantId)
  }

  async create(
    tenantId: string,
    input: Readonly<{ kind: ChannelKind; name: string; target: string }>,
  ): Promise<ChannelRecord> {
    const { hint, target } = normalizeChannelTarget(input.kind, input.target)

    return this.dependencies.channels.create(tenantId, {
      kind: input.kind,
      name: input.name,
      target,
      targetHint: hint,
    })
  }

  setEnabled(tenantId: string, channelId: string, enabled: boolean) {
    return this.dependencies.channels.setEnabled(tenantId, channelId, enabled)
  }

  remove(tenantId: string, channelId: string) {
    return this.dependencies.channels.remove(tenantId, channelId)
  }

  /** Sends a test message. Returns false when the channel does not exist. */
  async test(tenantId: string, channelId: string): Promise<boolean> {
    const secret = await this.dependencies.secrets.findTarget(
      tenantId,
      channelId,
    )

    if (!secret) {
      return false
    }

    await this.dependencies.sender.send({
      alert: {
        appOrigin: this.dependencies.appOrigin,
        event: 'test',
        monitorId: '00000000-0000-4000-8000-000000000000',
        monitorName: null,
        openedAtMs: null,
      },
      kind: secret.kind,
      target: secret.target,
    })

    return true
  }
}

export type ClaimedChannelDelivery = Readonly<{
  attempts: number
  channelKind: ChannelKind
  channelName: string
  deliveryId: string
  event: Exclude<AlertEvent, 'test'>
  monitorId: string
  monitorName: string | null
  openedAtMs: number | null
  target: string
}>

export interface ChannelDeliveryQueue {
  claim(batchSize: number): Promise<readonly ClaimedChannelDelivery[]>
  complete(
    result: Readonly<{
      deliveryId: string
      errorCode: string | null
      success: boolean
    }>,
  ): Promise<void>
}

export class DeliverChannelAlerts {
  constructor(
    private readonly dependencies: Readonly<{
      appOrigin: string
      queue: ChannelDeliveryQueue
      sender: ChannelSender
    }>,
  ) {}

  async execute(batchSize = 20): Promise<{ failed: number; sent: number }> {
    const deliveries = await this.dependencies.queue.claim(batchSize)
    let failed = 0
    let sent = 0

    for (const delivery of deliveries) {
      try {
        await this.dependencies.sender.send({
          alert: {
            appOrigin: this.dependencies.appOrigin,
            event: delivery.event,
            monitorId: delivery.monitorId,
            monitorName: delivery.monitorName,
            openedAtMs: delivery.openedAtMs,
          },
          kind: delivery.channelKind,
          target: delivery.target,
        })
        await this.dependencies.queue.complete({
          deliveryId: delivery.deliveryId,
          errorCode: null,
          success: true,
        })
        sent += 1
      } catch {
        await this.dependencies.queue.complete({
          deliveryId: delivery.deliveryId,
          errorCode: 'channel_delivery_failed',
          success: false,
        })
        failed += 1
      }
    }

    return { failed, sent }
  }
}

export interface IncidentReminderPort {
  enqueue(): Promise<number>
}

export class EnqueueIncidentReminders {
  constructor(private readonly port: IncidentReminderPort) {}

  execute(): Promise<number> {
    return this.port.enqueue()
  }
}
