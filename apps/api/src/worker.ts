import {
  createApiFromEnvironment,
  runNotificationDelivery,
  runScheduledCheck,
  type WorkerEnvironment,
} from './composition.ts'

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
        const delivery = await runNotificationDelivery(environment)

        console.info(JSON.stringify({ delivery, event: 'cron.tick', opened }))
      })(),
    )
  },
}
