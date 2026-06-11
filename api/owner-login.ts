import type { ApiRequest, ApiResponse } from './_lib/http'
import { readJsonBody, requireSameOrigin, sendError, setCookie } from './_lib/http'
import { createOwnerSession, OWNER_COOKIE, verifyPassword } from './_lib/security'

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (request.method !== 'POST') return sendError(response, 405, 'Method not allowed.')
  if (!requireSameOrigin(request)) return sendError(response, 403, 'Invalid request origin.')

  const storedHash = process.env.OWNER_PASSWORD_HASH
  if (!storedHash) return sendError(response, 503, 'Owner authentication is not configured.')

  let body: unknown
  try {
    body = readJsonBody(request)
  } catch {
    return sendError(response, 400, 'Invalid JSON body.')
  }
  const password = typeof body === 'object' && body !== null && 'password' in body
    ? (body as { password?: unknown }).password
    : undefined
  if (typeof password !== 'string' || !verifyPassword(password, storedHash)) {
    return sendError(response, 401, 'Invalid owner credentials.')
  }

  setCookie(request, response, OWNER_COOKIE, createOwnerSession(), { maxAge: 12 * 60 * 60 })
  response.status(200).json({ authenticated: true })
}
