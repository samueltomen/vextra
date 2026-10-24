import { Hono } from 'hono'

export const app = new Hono()

app.get('/api/health', (context) =>
  context.json({
    service: 'cronping-api',
    status: 'ok',
  }),
)
