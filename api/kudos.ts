import { createHash } from 'node:crypto'
import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { header, requireSameOrigin, sendError } from './_lib/http.js'

const COUNTER_KEY = 'runaround:kudos:count'
const VISITOR_KEY_PREFIX = 'runaround:kudos:visitor:'
const VISITOR_TTL_SECONDS = 24 * 60 * 60

interface RedisConfig {
  url: string
  token: string
}

/**
 * Supports both env names: Vercel's Upstash Marketplace integration injects
 * KV_REST_API_*, while a directly provisioned Upstash database uses
 * UPSTASH_REDIS_REST_*.
 */
function redisConfig(): RedisConfig | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

async function redisCommand(config: RedisConfig, command: (string | number)[]): Promise<unknown> {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error(`Redis command failed with status ${response.status}.`)
  const payload = await response.json() as { result?: unknown }
  return payload.result
}

function toCount(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0
}

/**
 * One kudos per visitor per day, keyed by a salted hash of the caller's IP.
 * The raw address is never stored; the hash expires after 24 hours.
 */
function visitorKey(request: ApiRequest): string {
  const ip = header(request, 'x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const salt = process.env.SESSION_SECRET ?? 'kudos-fallback-salt'
  return `${VISITOR_KEY_PREFIX}${createHash('sha256').update(`${salt}:${ip}`).digest('base64url')}`
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  const config = redisConfig()
  if (!config) return sendError(response, 503, 'Kudos is not configured.')

  try {
    if (request.method === 'GET') {
      const count = toCount(await redisCommand(config, ['GET', COUNTER_KEY]))
      response.setHeader('Cache-Control', 'no-store')
      response.status(200).json({ count })
      return
    }

    if (request.method !== 'POST') return sendError(response, 405, 'Method not allowed.')
    if (!requireSameOrigin(request)) return sendError(response, 403, 'Invalid request origin.')

    const isNewVisitor = await redisCommand(
      config,
      ['SET', visitorKey(request), '1', 'NX', 'EX', VISITOR_TTL_SECONDS],
    ) === 'OK'

    const count = isNewVisitor
      ? toCount(await redisCommand(config, ['INCR', COUNTER_KEY]))
      : toCount(await redisCommand(config, ['GET', COUNTER_KEY]))

    response.status(200).json({ count, counted: isNewVisitor })
  } catch {
    sendError(response, 502, 'Kudos is temporarily unavailable.')
  }
}
