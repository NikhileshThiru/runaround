import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOwnerSession, OWNER_COOKIE, OAUTH_STATE_COOKIE } from './_lib/security'
import type { ApiRequest, ApiResponse } from './_lib/http'
import handler from './strava-callback'

function responseRecorder() {
  let statusCode = 200
  let body: unknown
  const headers = new Map<string, number | string | string[]>()
  const response: ApiResponse = {
    status(code) { statusCode = code; return response },
    json(value) { body = value },
    setHeader(name, value) { headers.set(name.toLowerCase(), typeof value === 'string' ? value : Array.from(value)) },
    getHeader(name) { return headers.get(name.toLowerCase()) },
    redirect(statusOrUrl, url) {
      statusCode = typeof statusOrUrl === 'number' ? statusOrUrl : 302
      headers.set('location', typeof statusOrUrl === 'string' ? statusOrUrl : url ?? '')
    },
  }
  return { response, get statusCode() { return statusCode }, get body() { return body }, headers }
}

function request(state: string, scope = 'activity:read_all'): ApiRequest {
  const owner = createOwnerSession()
  return {
    method: 'GET',
    headers: {
      host: 'localhost:3000',
      cookie: `${OWNER_COOKIE}=${owner}; ${OAUTH_STATE_COOKIE}=expected-state`,
    },
    query: { state, code: 'authorization-code', scope },
  }
}

describe('Strava OAuth callback', () => {
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

  it('rejects state mismatch before exchanging a code', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const recorder = responseRecorder()

    await handler(request('wrong-state'), recorder.response)

    expect(recorder.statusCode).toBe(400)
    expect(recorder.body).toEqual({ error: 'Invalid OAuth state.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects authorization without activity:read_all', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const recorder = responseRecorder()

    await handler(request('expected-state', 'read'), recorder.response)

    expect(recorder.statusCode).toBe(400)
    expect(recorder.body).toEqual({ error: 'Required Strava scope was not granted.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stores encrypted tokens in cookies and redirects without exposing them in the URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'private-access-token',
      refresh_token: 'private-refresh-token',
      expires_at: 2_000_000_000,
    }), { status: 200 })))
    const recorder = responseRecorder()

    await handler(request('expected-state'), recorder.response)

    expect(recorder.statusCode).toBe(302)
    expect(recorder.headers.get('location')).toBe('/?strava=connected')
    const cookies = JSON.stringify(recorder.headers.get('set-cookie'))
    expect(cookies).toContain('runaround_strava=')
    expect(cookies).not.toContain('private-access-token')
    expect(cookies).not.toContain('private-refresh-token')
  })
})
