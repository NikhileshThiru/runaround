import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { createOwnerSession, OWNER_COOKIE } from './_lib/security.js'
import { computeAthleteProfile } from '../src/lib/athleteProfile.js'
import handler from './gemini.js'

function responseRecorder() {
  let statusCode = 200
  let body: unknown
  const response: ApiResponse = {
    status(code) { statusCode = code; return response },
    json(value) { body = value },
    setHeader() {},
    getHeader() { return undefined },
  }
  return { response, get statusCode() { return statusCode }, get body() { return body } }
}

function request(profile: ReturnType<typeof computeAthleteProfile>): ApiRequest {
  return {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      cookie: `${OWNER_COOKIE}=${createOwnerSession()}`,
    },
    body: { operation: 'coachingRecommendation', profile, recentActivities: [] },
  }
}

describe('Gemini coaching proxy', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-characters'
    process.env.GEMINI_API_KEY = 'gemini-test-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.GEMINI_API_KEY
  })

  it('returns forced rest without making an external Gemini call', async () => {
    const base = computeAthleteProfile([], undefined, new Date('2026-06-09T12:00:00.000Z'))
    const profile = {
      ...base,
      fitness: { ...base.fitness, form: -25 },
      coachingFlags: { ...base.coachingFlags, formBelowSafetyFloor: true },
    }
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const recorder = responseRecorder()

    await handler(request(profile), recorder.response)

    expect(recorder.statusCode).toBe(200)
    expect(recorder.body).toMatchObject({ intensity: 'rest', distanceOrDuration: 'No running mileage' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('replaces invalid structured output with a deterministic safe recommendation', async () => {
    const profile = computeAthleteProfile([], undefined, new Date('2026-06-09T12:00:00.000Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"unexpected":true}' }] } }],
    }), { status: 200 })))
    const recorder = responseRecorder()

    await handler(request(profile), recorder.response)

    expect(recorder.statusCode).toBe(200)
    expect(recorder.body).toMatchObject({ intensity: 'easy', sessionType: 'Conservative easy run' })
  })
})
