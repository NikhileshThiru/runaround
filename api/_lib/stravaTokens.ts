import type { ApiRequest, ApiResponse } from './http.js'
import { cookies, setCookie } from './http.js'
import {
  decryptStravaTokens,
  encryptStravaTokens,
  STRAVA_TOKEN_COOKIE,
  type StravaTokenSet,
} from './security.js'

interface StravaTokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
}

const TOKEN_ENDPOINT = 'https://www.strava.com/oauth/token'

function clientConfiguration() {
  const clientId = process.env.VITE_STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Strava server credentials are not configured.')
  return { clientId, clientSecret }
}

export function setStravaTokenCookie(
  request: ApiRequest,
  response: ApiResponse,
  tokens: StravaTokenSet,
): void {
  setCookie(request, response, STRAVA_TOKEN_COOKIE, encryptStravaTokens(tokens), {
    maxAge: 30 * 24 * 60 * 60,
  })
}

export function readStravaTokenCookie(request: ApiRequest): StravaTokenSet | null {
  return decryptStravaTokens(cookies(request)[STRAVA_TOKEN_COOKIE])
}

export async function refreshStravaTokens(refreshToken: string): Promise<StravaTokenSet> {
  const { clientId, clientSecret } = clientConfiguration()
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!response.ok) throw new Error(`Strava token refresh failed with status ${response.status}.`)
  const payload = await response.json() as Partial<StravaTokenResponse>
  if (!payload.access_token || !payload.refresh_token || !payload.expires_at) {
    throw new Error('Strava returned an invalid token refresh response.')
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_at,
  }
}

export async function currentStravaTokens(
  request: ApiRequest,
  response: ApiResponse,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<StravaTokenSet | null> {
  const tokens = readStravaTokenCookie(request)
  if (!tokens) return null
  if (tokens.expiresAt > nowSeconds + 300) return tokens

  const refreshed = await refreshStravaTokens(tokens.refreshToken)
  setStravaTokenCookie(request, response, refreshed)
  return refreshed
}
