import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiRequest, ApiResponse } from './http.js'
import { encryptStravaTokens, STRAVA_TOKEN_COOKIE } from './security.js'
import { currentStravaTokens } from './stravaTokens.js'

function responseRecorder() {
  const headers = new Map<string, number | string | string[]>()
  const response: ApiResponse = {
    status() { return response },
    json() {},
    setHeader(name, value) { headers.set(name.toLowerCase(), typeof value === 'string' ? value : Array.from(value)) },
    getHeader(name) { return headers.get(name.toLowerCase()) },
  }
  return { response, headers }
}

describe('Strava token refresh', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-characters'
    process.env.VITE_STRAVA_CLIENT_ID = 'client-id'
    process.env.STRAVA_CLIENT_SECRET = 'client-secret'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.VITE_STRAVA_CLIENT_ID
    delete process.env.STRAVA_CLIENT_SECRET
  })

  it('rotates the refresh token and replaces the encrypted cookie before expiry', async () => {
    const encrypted = encryptStravaTokens({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: 1_100,
    })
    const request: ApiRequest = { headers: { cookie: `${STRAVA_TOKEN_COOKIE}=${encrypted}` } }
    const recorder = responseRecorder()
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_at: 3_000,
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const refreshed = await currentStravaTokens(request, recorder.response, 1_000)

    expect(refreshed).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh', expiresAt: 3_000 })
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[1].body).toBeInstanceOf(URLSearchParams)
    expect((call[1].body as URLSearchParams).toString()).toContain('refresh_token=old-refresh')
    const cookie = JSON.stringify(recorder.headers.get('set-cookie'))
    expect(cookie).toContain('runaround_strava=')
    expect(cookie).not.toContain('new-refresh')
  })
})
