import type { ApiRequest, ApiResponse } from './_lib/http'
import { clearCookie, requireSameOrigin, sendError } from './_lib/http'
import { OAUTH_STATE_COOKIE, OWNER_COOKIE, STRAVA_TOKEN_COOKIE } from './_lib/security'

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (request.method !== 'POST') return sendError(response, 405, 'Method not allowed.')
  if (!requireSameOrigin(request)) return sendError(response, 403, 'Invalid request origin.')

  clearCookie(request, response, OWNER_COOKIE)
  clearCookie(request, response, OAUTH_STATE_COOKIE)
  clearCookie(request, response, STRAVA_TOKEN_COOKIE)
  response.status(200).json({ authenticated: false })
}
