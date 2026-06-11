import type { ApiRequest, ApiResponse } from './_lib/http'
import { clearCookie, readJsonBody, requireSameOrigin, sendError } from './_lib/http'
import { isOwnerRequest, STRAVA_TOKEN_COOKIE } from './_lib/security'
import { currentStravaTokens } from './_lib/stravaTokens'

const STRAVA_API = 'https://www.strava.com/api/v3'
const STREAM_KEYS = new Set(['time', 'distance', 'velocity_smooth', 'heartrate', 'cadence', 'watts'])

type ProxyOperation =
  | { operation: 'athlete' }
  | { operation: 'activities'; page?: number; perPage?: number; after?: number; before?: number }
  | { operation: 'activityDetail'; id: number }
  | { operation: 'activityStreams'; id: number; keys: string[] }
  | { operation: 'deauthorize' }

function positiveInteger(value: unknown, fallback?: number): number | undefined {
  if (value === undefined) return fallback
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : undefined
}

export function parseOperation(body: unknown): ProxyOperation | null {
  if (!body || typeof body !== 'object' || !('operation' in body)) return null
  const input = body as Record<string, unknown>
  if (input.operation === 'athlete') return { operation: 'athlete' }
  if (input.operation === 'deauthorize') return { operation: 'deauthorize' }

  if (input.operation === 'activities') {
    const page = positiveInteger(input.page, 1)
    const perPage = positiveInteger(input.perPage, 100)
    if (!page || !perPage || perPage > 200) return null
    const after = input.after === undefined ? undefined : positiveInteger(input.after)
    const before = input.before === undefined ? undefined : positiveInteger(input.before)
    if (input.after !== undefined && !after) return null
    if (input.before !== undefined && !before) return null
    return { operation: 'activities', page, perPage, after, before }
  }

  const id = positiveInteger(input.id)
  if (!id) return null
  if (input.operation === 'activityDetail') return { operation: 'activityDetail', id }
  if (input.operation === 'activityStreams' && Array.isArray(input.keys)) {
    const keys = input.keys.filter((key): key is string => typeof key === 'string')
    if (keys.length === 0 || keys.length !== input.keys.length || keys.some((key) => !STREAM_KEYS.has(key))) {
      return null
    }
    return { operation: 'activityStreams', id, keys: [...new Set(keys)] }
  }
  return null
}

function operationRequest(operation: ProxyOperation, accessToken: string): { url: URL; init: RequestInit } {
  const headers = { Authorization: `Bearer ${accessToken}` }
  if (operation.operation === 'athlete') {
    return { url: new URL(`${STRAVA_API}/athlete`), init: { headers } }
  }
  if (operation.operation === 'activities') {
    const url = new URL(`${STRAVA_API}/athlete/activities`)
    url.searchParams.set('page', String(operation.page ?? 1))
    url.searchParams.set('per_page', String(operation.perPage ?? 100))
    if (operation.after) url.searchParams.set('after', String(operation.after))
    if (operation.before) url.searchParams.set('before', String(operation.before))
    return { url, init: { headers } }
  }
  if (operation.operation === 'activityDetail') {
    return { url: new URL(`${STRAVA_API}/activities/${operation.id}`), init: { headers } }
  }
  if (operation.operation === 'activityStreams') {
    const url = new URL(`${STRAVA_API}/activities/${operation.id}/streams`)
    url.searchParams.set('keys', operation.keys.join(','))
    url.searchParams.set('key_by_type', 'true')
    return { url, init: { headers } }
  }
  return {
    url: new URL('https://www.strava.com/oauth/deauthorize'),
    init: { method: 'POST', headers },
  }
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== 'POST') return sendError(response, 405, 'Method not allowed.')
  if (!requireSameOrigin(request)) return sendError(response, 403, 'Invalid request origin.')
  if (!isOwnerRequest(request)) return sendError(response, 401, 'Owner authentication required.')

  let operation: ProxyOperation | null
  try {
    operation = parseOperation(readJsonBody(request))
  } catch {
    return sendError(response, 400, 'Invalid JSON body.')
  }
  if (!operation) return sendError(response, 400, 'Unsupported Strava operation.')

  let tokens
  try {
    tokens = await currentStravaTokens(request, response)
  } catch {
    return sendError(response, 502, 'Unable to refresh Strava authorization.')
  }
  if (!tokens) return sendError(response, 401, 'Strava connection required.')

  const outbound = operationRequest(operation, tokens.accessToken)
  const stravaResponse = await fetch(outbound.url, outbound.init)
  const payload: unknown = await stravaResponse.json().catch(() => null)

  for (const name of ['x-ratelimit-limit', 'x-ratelimit-usage', 'x-readratelimit-limit', 'x-readratelimit-usage']) {
    const value = stravaResponse.headers.get(name)
    if (value) response.setHeader(name, value)
  }

  if (operation.operation === 'deauthorize' && stravaResponse.ok) {
    clearCookie(request, response, STRAVA_TOKEN_COOKIE)
  }
  if (!stravaResponse.ok) return sendError(response, stravaResponse.status, 'Strava request failed.')
  response.status(200).json(payload)
}
