import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { clearCookie, cookies, queryValue, redirect, sendError } from './_lib/http.js'
import { isOwnerRequest, OAUTH_STATE_COOKIE, safeEqual } from './_lib/security.js'
import { setStravaTokenCookie } from './_lib/stravaTokens.js'

interface TokenExchangeResponse {
  access_token: string
  refresh_token: string
  expires_at: number
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== 'GET') return sendError(response, 405, 'Method not allowed.')
  if (!isOwnerRequest(request)) return sendError(response, 401, 'Owner authentication required.')

  const expectedState = cookies(request)[OAUTH_STATE_COOKIE]
  const returnedState = queryValue(request, 'state')
  clearCookie(request, response, OAUTH_STATE_COOKIE)
  if (!safeEqual(expectedState, returnedState)) return sendError(response, 400, 'Invalid OAuth state.')
  if (queryValue(request, 'error')) return redirect(response, '/?strava=denied')

  const code = queryValue(request, 'code')
  const scope = queryValue(request, 'scope') ?? ''
  if (!code) return sendError(response, 400, 'Missing Strava authorization code.')
  if (!scope.split(',').includes('activity:read_all')) {
    return sendError(response, 400, 'Required Strava scope was not granted.')
  }

  const clientId = process.env.VITE_STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) return sendError(response, 503, 'Strava credentials are not configured.')

  const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenResponse.ok) return sendError(response, 502, 'Strava token exchange failed.')
  const payload = await tokenResponse.json() as Partial<TokenExchangeResponse>
  if (!payload.access_token || !payload.refresh_token || !payload.expires_at) {
    return sendError(response, 502, 'Strava returned an invalid token response.')
  }

  setStravaTokenCookie(request, response, {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_at,
  })
  redirect(response, '/?strava=connected')
}
