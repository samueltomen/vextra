import { describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest } from './client.ts'

describe('apiRequest', () => {
  it('sends credentials and JSON without exposing headers to callers', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: { status: 'ok' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiRequest<{ data: { status: string } }>('/api/test', {
        body: JSON.stringify({ value: true }),
        method: 'POST',
      }),
    ).resolves.toEqual({ data: { status: 'ok' } })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    )
  })

  it('supports empty successful responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    )

    await expect(apiRequest('/api/logout')).resolves.toBeUndefined()
  })

  it('exposes safe API errors and tolerates non-JSON failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json(
            { error: { code: 'forbidden', message: 'Denied' } },
            { status: 403 },
          ),
        )
        .mockResolvedValueOnce(
          new Response('gateway failure', { status: 502 }),
        ),
    )

    await expect(apiRequest('/api/private')).rejects.toEqual(
      new ApiError(403, 'forbidden', 'Denied'),
    )
    await expect(apiRequest('/api/private')).rejects.toMatchObject({
      code: 'request_failed',
      status: 502,
    })
  })
})
