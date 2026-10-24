import {
  createApiFromEnvironment,
  type WorkerEnvironment,
} from './composition.ts'

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
}
