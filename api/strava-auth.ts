import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { redirect, requestOrigin, sendError, setCookie } from './_lib/http.js'
import { isOwnerRequest, OAUTH_STATE_COOKIE, randomState } from './_lib/security.js'

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (request.method !== 'GET') return sendError(response, 405, 'Method not allowed.')
  if (!isOwnerRequest(request)) return sendError(response, 401, 'Owner authentication required.')

  const clientId = process.env.VITE_STRAVA_CLIENT_ID
  if (!clientId) return sendError(response, 503, 'Strava client ID is not configured.')

  const state = randomState()
  setCookie(request, response, OAUTH_STATE_COOKIE, state, { maxAge: 10 * 60 })
  const authorizationUrl = new URL('https://www.strava.com/oauth/authorize')
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${requestOrigin(request)}/api/strava-callback`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
    state,
  }).toString()
  redirect(response, authorizationUrl.toString())
}
