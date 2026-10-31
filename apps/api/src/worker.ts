import {
  createApiFromEnvironment,
  runChannelDelivery,
  runIncidentReminders,
  runNotificationDelivery,
  runWeeklyReports,
  runScheduledCheck,
  type WorkerEnvironment,
} from './composition.ts'

export { TenantLiveHub } from './features/live/adapters/outbound/tenant-live-hub.ts'

type ScheduledContext = Readonly<{
  waitUntil(promise: Promise<unknown>): void
}>

export default {
  fetch(request: Request, environment: WorkerEnvironment) {
    try {
      return createApiFromEnvironment(environment).fetch(request, environment)
    } catch {
      return Response.json(
        {
          error: {
            code: 'service_unavailable',
            message: 'Service is not configured',
          },
        },
        { status: 503 },
      )
    }
  },
  scheduled(
    _controller: unknown,
    environment: WorkerEnvironment,
    context: ScheduledContext,
  ) {
    context.waitUntil(
      (async () => {
        const opened = await runScheduledCheck(environment)
        const reminders = await runIncidentReminders(environment)
        const delivery = await runNotificationDelivery(environment)
        const channels = await runChannelDelivery(environment)
        const weekly = await runWeeklyReports(environment)

        console.info(
          JSON.stringify({
            channels,
            delivery,
            event: 'cron.tick',
            opened,
            reminders,
            weekly,
          }),
        )
      })(),
    )
  },
}
