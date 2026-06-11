import {
  clearActivityData,
  getActivityDetail,
  getActivitySummariesNewestFirst,
  getPbScanState,
  getStream,
  putActivityDetail,
  putActivitySummaries,
  putPbScanState,
  putStream,
  setMetadata,
} from '@/db/runaroundDb'
import { pbScanStateSchema } from '@/schemas/athleteProfile'
import {
  stravaActivityDetailSchema,
  stravaActivitySummariesSchema,
  stravaStreamsSchema,
  type StravaActivityDetail,
  type StravaStream,
} from '@/schemas/strava'
import { createPbScanState, markPbScanError, mergeActivityIntoPbScan } from './personalBests'
import { isRun } from './athleteProfile'
import {
  fetchActivityDetailWithResponse,
  fetchActivityStreamsWithResponse,
  fetchActivitySummariesWithResponse,
  type StravaStreamKey,
} from './strava'

export interface RateLimitWindow {
  shortLimit: number | null
  dailyLimit: number | null
  shortUsage: number | null
  dailyUsage: number | null
}

export interface SyncResult {
  changed: boolean
  fetchedCount: number
  pausedForRateLimit: boolean
}

function pair(value: string | null): [number | null, number | null] {
  if (!value) return [null, null]
  const [short, daily] = value.split(',').map(Number)
  return [
    short !== undefined && Number.isFinite(short) ? short : null,
    daily !== undefined && Number.isFinite(daily) ? daily : null,
  ]
}

export function parseRateLimitHeaders(headers: Headers): RateLimitWindow {
  const [shortLimit, dailyLimit] = pair(
    headers.get('x-readratelimit-limit') ?? headers.get('x-ratelimit-limit'),
  )
  const [shortUsage, dailyUsage] = pair(
    headers.get('x-readratelimit-usage') ?? headers.get('x-ratelimit-usage'),
  )
  return { shortLimit, dailyLimit, shortUsage, dailyUsage }
}

export function shouldPauseForRateLimit(rate: RateLimitWindow, reserve = 5): boolean {
  const shortExhausted = rate.shortLimit !== null
    && rate.shortUsage !== null
    && rate.shortLimit - rate.shortUsage <= reserve
  const dailyExhausted = rate.dailyLimit !== null
    && rate.dailyUsage !== null
    && rate.dailyLimit - rate.dailyUsage <= reserve
  return shortExhausted || dailyExhausted
}

async function fetchAndStoreSummaryPages(after?: number): Promise<SyncResult> {
  let page = 1
  let fetchedCount = 0
  let pausedForRateLimit = false

  while (true) {
    const response = await fetchActivitySummariesWithResponse<unknown>({ page, perPage: 200, after })
    const activities = stravaActivitySummariesSchema.parse(response.data)
    if (activities.length === 0) break
    await putActivitySummaries(activities)
    fetchedCount += activities.length

    const rate = parseRateLimitHeaders(response.headers)
    await setMetadata('stravaRateLimit', rate)
    if (shouldPauseForRateLimit(rate)) {
      pausedForRateLimit = true
      await setMetadata('summarySyncResume', { page: page + 1, after })
      break
    }
    if (activities.length < 200) break
    page += 1
  }

  if (!pausedForRateLimit) await setMetadata('summarySyncResume', null)
  return { changed: fetchedCount > 0, fetchedCount, pausedForRateLimit }
}

export async function syncActivitySummaries(): Promise<SyncResult> {
  const cached = await getActivitySummariesNewestFirst()
  if (cached.length === 0) return fetchAndStoreSummaryPages()

  const newestResponse = await fetchActivitySummariesWithResponse<unknown>({ page: 1, perPage: 1 })
  const newestRemote = stravaActivitySummariesSchema.parse(newestResponse.data)[0]
  const rate = parseRateLimitHeaders(newestResponse.headers)
  await setMetadata('stravaRateLimit', rate)

  if (!newestRemote) {
    return { changed: false, fetchedCount: 0, pausedForRateLimit: shouldPauseForRateLimit(rate) }
  }
  if (newestRemote.id === cached[0]!.id) {
    const cachedNewest = cached[0]!
    const changed = newestRemote.start_date !== cachedNewest.start_date
      || newestRemote.distance !== cachedNewest.distance
      || newestRemote.moving_time !== cachedNewest.moving_time
      || newestRemote.name !== cachedNewest.name
    if (changed) await putActivitySummaries([newestRemote])
    return { changed, fetchedCount: changed ? 1 : 0, pausedForRateLimit: shouldPauseForRateLimit(rate) }
  }
  if (shouldPauseForRateLimit(rate)) {
    return { changed: false, fetchedCount: 0, pausedForRateLimit: true }
  }

  const after = Math.floor(Date.parse(cached[0]!.start_date) / 1000)
  return fetchAndStoreSummaryPages(after)
}

export async function fullResyncActivitySummaries(): Promise<SyncResult> {
  await clearActivityData()
  return fetchAndStoreSummaryPages()
}

export async function getOrFetchActivityDetail(activityId: number): Promise<StravaActivityDetail> {
  const cached = await getActivityDetail(activityId)
  if (cached) return cached
  const response = await fetchActivityDetailWithResponse<unknown>(activityId)
  const detail = stravaActivityDetailSchema.parse(response.data)
  await putActivityDetail(detail)
  await setMetadata('stravaRateLimit', parseRateLimitHeaders(response.headers))
  return detail
}

export async function getOrFetchStreams(
  activityId: number,
  keys: readonly StravaStreamKey[],
): Promise<Record<string, StravaStream>> {
  const result: Record<string, StravaStream> = {}
  const missing: StravaStreamKey[] = []
  for (const key of keys) {
    const cached = await getStream(activityId, key)
    if (cached) result[key] = cached
    else missing.push(key)
  }
  if (missing.length === 0) return result

  const response = await fetchActivityStreamsWithResponse<unknown>(activityId, missing)
  const streams = stravaStreamsSchema.parse(response.data)
  for (const [key, stream] of Object.entries(streams)) {
    if (!missing.includes(key as StravaStreamKey)) continue
    await putStream(activityId, key, stream)
    result[key] = stream
  }
  await setMetadata('stravaRateLimit', parseRateLimitHeaders(response.headers))
  return result
}

export async function resumePersonalBestScan(): Promise<{ scanned: number; complete: boolean; paused: boolean }> {
  const summaries = await getActivitySummariesNewestFirst()
  const runs = summaries.filter(isRun)
  let state = pbScanStateSchema.parse(
    await getPbScanState() ?? createPbScanState(runs.length),
  )
  if (state.totalRunCount !== runs.length) {
    state = { ...state, totalRunCount: runs.length, status: 'scanning' }
  }

  const scanned = new Set(state.scannedActivityIds)
  let scannedThisRun = 0
  let paused = false
  try {
    for (const summary of runs) {
      if (scanned.has(summary.id)) continue
      const response = await fetchActivityDetailWithResponse<unknown>(summary.id)
      const detail = stravaActivityDetailSchema.parse(response.data)
      await putActivityDetail(detail)
      state = mergeActivityIntoPbScan(state, detail)
      await putPbScanState(state)
      scannedThisRun += 1

      const rate = parseRateLimitHeaders(response.headers)
      await setMetadata('stravaRateLimit', rate)
      if (shouldPauseForRateLimit(rate)) {
        paused = true
        break
      }
    }
  } catch (error) {
    state = markPbScanError(state, error instanceof Error ? error.message : 'Unknown PB scan error')
    await putPbScanState(state)
    throw error
  }

  if (!paused && state.scannedActivityIds.length >= runs.length) {
    state = { ...state, status: 'complete', updatedAt: new Date().toISOString() }
    await putPbScanState(state)
  }
  return { scanned: scannedThisRun, complete: state.status === 'complete', paused }
}
