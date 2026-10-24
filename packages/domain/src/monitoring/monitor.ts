export const MIN_INTERVAL_SECONDS = 60

export type MonitorStatus = 'pending' | 'healthy' | 'late' | 'paused'

export type Monitor = Readonly<{
  id: string
  tenantId: string
  intervalSeconds: number
  graceSeconds: number
  status: MonitorStatus
  lastHeartbeatAtMs: number | null
  alertAtMs: number
  incidentOpenedAtMs: number | null
  pausedAtMs: number | null
}>

export type CreateMonitorInput = Readonly<{
  id: string
  tenantId: string
  intervalSeconds: number
  graceSeconds: number
  nowMs: number
}>

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new RangeError(`${field} must not be empty`)
  }
}

function assertTimestamp(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a valid epoch timestamp`)
  }
}

function assertSeconds(value: number, field: string, minimum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(
      `${field} must be an integer greater than or equal to ${minimum}`,
    )
  }
}

function addSeconds(timestampMs: number, seconds: number): number {
  const nextTimestampMs = timestampMs + seconds * 1_000

  if (!Number.isSafeInteger(nextTimestampMs)) {
    throw new RangeError(
      'monitor deadline exceeds the supported timestamp range',
    )
  }

  return nextTimestampMs
}

export function assertMonitorSchedule(
  intervalSeconds: number,
  graceSeconds: number,
): void {
  assertSeconds(intervalSeconds, 'intervalSeconds', MIN_INTERVAL_SECONDS)
  assertSeconds(graceSeconds, 'graceSeconds', 0)
}

export function createMonitor(input: CreateMonitorInput): Monitor {
  assertNonEmpty(input.id, 'id')
  assertNonEmpty(input.tenantId, 'tenantId')
  assertMonitorSchedule(input.intervalSeconds, input.graceSeconds)
  assertTimestamp(input.nowMs, 'nowMs')

  return {
    id: input.id,
    tenantId: input.tenantId,
    intervalSeconds: input.intervalSeconds,
    graceSeconds: input.graceSeconds,
    status: 'pending',
    lastHeartbeatAtMs: null,
    alertAtMs: addSeconds(
      input.nowMs,
      input.intervalSeconds + input.graceSeconds,
    ),
    incidentOpenedAtMs: null,
    pausedAtMs: null,
  }
}

export function registerHeartbeat(
  monitor: Monitor,
  receivedAtMs: number,
): Monitor {
  assertTimestamp(receivedAtMs, 'receivedAtMs')

  if (
    monitor.status === 'paused' ||
    (monitor.lastHeartbeatAtMs !== null &&
      receivedAtMs <= monitor.lastHeartbeatAtMs)
  ) {
    return monitor
  }

  return {
    ...monitor,
    status: 'healthy',
    lastHeartbeatAtMs: receivedAtMs,
    alertAtMs: addSeconds(
      receivedAtMs,
      monitor.intervalSeconds + monitor.graceSeconds,
    ),
    incidentOpenedAtMs: null,
  }
}

export function detectOverdue(monitor: Monitor, nowMs: number): Monitor {
  assertTimestamp(nowMs, 'nowMs')

  if (
    monitor.status === 'paused' ||
    monitor.incidentOpenedAtMs !== null ||
    nowMs < monitor.alertAtMs
  ) {
    return monitor
  }

  return {
    ...monitor,
    status: 'late',
    incidentOpenedAtMs: nowMs,
  }
}

export function pauseMonitor(monitor: Monitor, nowMs: number): Monitor {
  assertTimestamp(nowMs, 'nowMs')

  if (monitor.status === 'paused') {
    return monitor
  }

  return {
    ...monitor,
    status: 'paused',
    incidentOpenedAtMs: null,
    pausedAtMs: nowMs,
  }
}

export function resumeMonitor(monitor: Monitor, nowMs: number): Monitor {
  assertTimestamp(nowMs, 'nowMs')

  if (monitor.status !== 'paused') {
    return monitor
  }

  return {
    ...monitor,
    status: monitor.lastHeartbeatAtMs === null ? 'pending' : 'healthy',
    alertAtMs: addSeconds(
      nowMs,
      monitor.intervalSeconds + monitor.graceSeconds,
    ),
    incidentOpenedAtMs: null,
    pausedAtMs: null,
  }
}
