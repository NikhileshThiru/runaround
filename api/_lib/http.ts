import { parse, serialize, type SerializeOptions } from 'cookie'

export interface ApiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface ApiResponse {
  status(code: number): ApiResponse
  json(body: unknown): void
  setHeader(name: string, value: string | readonly string[]): void
  getHeader(name: string): number | string | string[] | undefined
  redirect?(statusOrUrl: number | string, url?: string): void
  end?(body?: string): void
}

export function header(request: ApiRequest, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

export function queryValue(request: ApiRequest, name: string): string | undefined {
  const value = request.query?.[name]
  return Array.isArray(value) ? value[0] : value
}

export function cookies(request: ApiRequest): Record<string, string | undefined> {
  return parse(header(request, 'cookie') ?? '')
}

export function isSecureRequest(request: ApiRequest): boolean {
  const protocol = header(request, 'x-forwarded-proto')?.split(',')[0]?.trim()
  return protocol === 'https' || process.env.NODE_ENV === 'production'
}

export function requestOrigin(request: ApiRequest): string {
  const host = header(request, 'x-forwarded-host') ?? header(request, 'host')
  if (!host) throw new Error('Request host is unavailable.')
  return `${isSecureRequest(request) ? 'https' : 'http'}://${host}`
}

export function requireSameOrigin(request: ApiRequest): boolean {
  const origin = header(request, 'origin')
  if (!origin) return false
  try {
    return new URL(origin).origin === requestOrigin(request)
  } catch {
    return false
  }
}

export function readJsonBody(request: ApiRequest): unknown {
  if (typeof request.body === 'string') return JSON.parse(request.body) as unknown
  return request.body
}

export function setCookie(
  request: ApiRequest,
  response: ApiResponse,
  name: string,
  value: string,
  options: SerializeOptions = {},
): void {
  const serialized = serialize(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(request),
    path: '/',
    ...options,
  })
  const existing = response.getHeader('Set-Cookie')
  const values = existing
    ? [...(Array.isArray(existing) ? existing.map(String) : [String(existing)]), serialized]
    : [serialized]
  response.setHeader('Set-Cookie', values)
}

export function clearCookie(request: ApiRequest, response: ApiResponse, name: string): void {
  setCookie(request, response, name, '', { maxAge: 0, expires: new Date(0) })
}

export function sendError(response: ApiResponse, status: number, message: string): void {
  response.status(status).json({ error: message })
}

export function redirect(response: ApiResponse, location: string, status = 302): void {
  if (response.redirect) {
    response.redirect(status, location)
    return
  }
  response.status(status)
  response.setHeader('Location', location)
  response.end?.()
}
