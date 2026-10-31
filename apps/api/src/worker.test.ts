import { describe, expect, it, vi } from 'vitest'

import { type WorkerEnvironment } from './composition.ts'
import worker from './worker.ts'

const ENVIRONMENT: WorkerEnvironment = {
  APP_ORIGIN: 'https://app.cronping.test',
  PING_TOKEN_PEPPER: 'pepper-with-at-least-thirty-two-characters',
  SESSION_ENCRYPTION_KEY: 'session-secret-with-at-least-32-bytes-of-entropy',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_URL: 'https://project.supabase.test',
}

function mockSupabase(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    claim_channel_deliveries: [],
    claim_notification_deliveries: [],
    enqueue_incident_reminders: 0,
    open_due_monitor_incidents: 0,
    ...overrides,
  }
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const name = Object.keys(responses).find((key) => url.includes(key))

    if (!name) {
      throw new Error(`Unexpected request: ${url}`)
    }

    return Response.json(responses[name])
  })

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

async function runScheduled(environment: typeof ENVIRONMENT) {
  let scheduledTask: Promise<unknown> | undefined

  worker.scheduled({}, environment, {
    waitUntil(promise) {
      scheduledTask = promise
    },
  })
  await scheduledTask
}

describe('Cloudflare Worker entrypoint', () => {
  it('serves requests when configuration is present', async () => {
    const response = await worker.fetch(
      new Request('https://api.cronping.test/api/health'),
      ENVIRONMENT,
    )

    expect(response.status).toBe(200)
  })

  it('returns a safe error when configuration is missing', async () => {
    const response = await worker.fetch(
      new Request('https://api.cronping.test/api/health'),
      {} as WorkerEnvironment,
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'service_unavailable',
        message: 'Service is not configured',
      },
    })
  })

  it('runs the checks, reminders and channel deliveries on each tick', async () => {
    const fetchMock = mockSupabase({ open_due_monitor_incidents: 2 })

    await runScheduled(ENVIRONMENT)

    const urls = fetchMock.mock.calls.map(([input]) => String(input))

    expect(urls.some((url) => url.includes('open_due_monitor_incidents'))).toBe(
      true,
    )
    expect(urls.some((url) => url.includes('enqueue_incident_reminders'))).toBe(
      true,
    )
    expect(urls.some((url) => url.includes('claim_channel_deliveries'))).toBe(
      true,
    )
    expect(
      urls.some((url) => url.includes('claim_notification_deliveries')),
    ).toBe(false)
  })

  it('claims e-mail deliveries too when Resend is configured', async () => {
    const fetchMock = mockSupabase()

    await runScheduled({
      ...ENVIRONMENT,
      RESEND_API_KEY: 're_test',
      RESEND_FROM_EMAIL: 'CronPing <alerts@example.test>',
    })

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes('claim_notification_deliveries'),
      ),
    ).toBe(true)
  })

  it('logs one structured tick per scheduled run', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    mockSupabase({
      enqueue_incident_reminders: 1,
      open_due_monitor_incidents: 2,
    })
    await runScheduled(ENVIRONMENT)

    expect(info).toHaveBeenCalledWith(
      JSON.stringify({
        channels: { failed: 0, sent: 0 },
        delivery: null,
        event: 'cron.tick',
        opened: 2,
        reminders: 1,
      }),
    )
    info.mockRestore()
  })
})
