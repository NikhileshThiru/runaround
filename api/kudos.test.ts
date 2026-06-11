import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './kudos.js'
import type { ApiRequest, ApiResponse } from './_lib/http.js'

function createResponse() {
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))
  const setHeader = vi.fn()
  return { response: { status, json, setHeader } as unknown as ApiResponse, status, json }
}

function commandName(init: RequestInit | undefined): string {
  const body = typeof init?.body === 'string' ? init.body : '[]'
  return (JSON.parse(body) as string[])[0] ?? ''
}

function redisFetchMock(results: Record<string, unknown>) {
  return vi.fn((_url: unknown, init?: RequestInit) => {
    const result = results[commandName(init)] ?? null
    return Promise.resolve(new Response(JSON.stringify({ result }), { status: 200 }))
  })
}

describe('kudos function', () => {
  beforeEach(() => {
    vi.stubEnv('KV_REST_API_URL', 'https://example-redis.upstash.io')
    vi.stubEnv('KV_REST_API_TOKEN', 'test-token')
    vi.stubEnv('SESSION_SECRET', 'a'.repeat(40))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns 503 when no Redis configuration exists', async () => {
    vi.stubEnv('KV_REST_API_URL', '')
    vi.stubEnv('KV_REST_API_TOKEN', '')
    const { response, status, json } = createResponse()

    await handler({ method: 'GET', headers: {} }, response)

    expect(status).toHaveBeenCalledWith(503)
    expect(json).toHaveBeenCalledWith({ error: 'Kudos is not configured.' })
  })

  it('returns the current count on GET', async () => {
    vi.stubGlobal('fetch', redisFetchMock({ GET: '41' }))
    const { response, status, json } = createResponse()

    await handler({ method: 'GET', headers: {} }, response)

    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith({ count: 41 })
  })

  it('rejects cross-origin POST requests', async () => {
    vi.stubGlobal('fetch', redisFetchMock({}))
    const { response, status } = createResponse()

    await handler({
      method: 'POST',
      headers: { host: 'run-around.vercel.app', origin: 'https://evil.example' },
    }, response)

    expect(status).toHaveBeenCalledWith(403)
  })

  it('increments once for a new visitor', async () => {
    const fetchMock = redisFetchMock({ SET: 'OK', INCR: 42 })
    vi.stubGlobal('fetch', fetchMock)
    const { response, json } = createResponse()

    await handler(sameOriginPost(), response)

    expect(json).toHaveBeenCalledWith({ count: 42, counted: true })
    const commands = fetchMock.mock.calls.map((call) => commandName(call[1] as RequestInit))
    expect(commands).toEqual(['SET', 'INCR'])
  })

  it('does not increment for a repeat visitor', async () => {
    const fetchMock = redisFetchMock({ SET: null, GET: '42' })
    vi.stubGlobal('fetch', fetchMock)
    const { response, json } = createResponse()

    await handler(sameOriginPost(), response)

    expect(json).toHaveBeenCalledWith({ count: 42, counted: false })
    const commands = fetchMock.mock.calls.map((call) => commandName(call[1] as RequestInit))
    expect(commands).toEqual(['SET', 'GET'])
  })

  it('reports a gateway error when Redis is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('nope', { status: 500 }))))
    const { response, status } = createResponse()

    await handler({ method: 'GET', headers: {} }, response)

    expect(status).toHaveBeenCalledWith(502)
  })
})

function sameOriginPost(): ApiRequest {
  return {
    method: 'POST',
    headers: {
      host: 'run-around.vercel.app',
      'x-forwarded-proto': 'https',
      origin: 'https://run-around.vercel.app',
      'x-forwarded-for': '203.0.113.7',
    },
  }
}
