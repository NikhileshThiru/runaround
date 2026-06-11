export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiRequestWithResponse<T>(path, init)).data
}

export async function apiRequestWithResponse<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; headers: Headers; status: number }> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  })
  const payload = await response.json().catch(() => null) as { error?: unknown } | null
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string'
      ? payload.error
      : `Request failed with status ${response.status}.`
    throw new ApiError(message, response.status)
  }
  return { data: payload as T, headers: response.headers, status: response.status }
}

export function sameOriginPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function sameOriginPostWithResponse<T>(path: string, body: unknown) {
  return apiRequestWithResponse<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
