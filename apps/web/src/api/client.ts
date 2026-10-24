export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type ErrorBody = {
  error?: {
    code?: string
    message?: string
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    let body: ErrorBody = {}

    try {
      body = (await response.json()) as ErrorBody
    } catch {
      // The status remains the source of truth when an upstream returns no JSON.
    }

    throw new ApiError(
      response.status,
      body.error?.code ?? 'request_failed',
      body.error?.message ?? 'Request failed',
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
