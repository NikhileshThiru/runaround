import {
  activityDescriptionSchema,
  activityAssessmentInputSchema,
  cachedRecommendationSchema,
  coachingActivityInputSchema,
  coachingRecommendationSchema,
  type CachedRecommendation,
  type CoachingRecommendation,
} from '@/schemas/ai'
import type { AthleteProfile } from '@/schemas/athleteProfile'
import type { StravaActivityDetail, StravaActivitySummary } from '@/schemas/strava'
import { openRunAroundDb } from '@/db/runaroundDb'
import { sameOriginPost } from './apiClient'
import { isRun, normalizeRunningCadence } from './athleteProfile'

const COACHING_CACHE_PREFIX = 'runaround_coaching_'

function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function getCoachingRecommendation(
  profile: AthleteProfile,
  recentActivities: readonly StravaActivitySummary[],
  options: { regenerate?: boolean; now?: Date } = {},
): Promise<CoachingRecommendation> {
  const date = localDateKey(options.now)
  const watermark = recentActivities[0]?.start_date ?? null
  const cached = getCachedCoachingRecommendation(date)
  if (cached && (!options.regenerate || !watermark || watermark <= (cached.activityWatermark ?? ''))) {
    return cached.recommendation
  }

  const recommendation = coachingRecommendationSchema.parse(await sameOriginPost('/api/gemini', {
    operation: 'coachingRecommendation',
    profile,
    recentActivities: recentActivities.slice(0, 100).map((activity) => coachingActivityInputSchema.parse({
      date: activity.start_date_local.slice(0, 10),
      sportType: activity.sport_type ?? activity.type,
      distanceMeters: activity.distance,
      movingTimeSeconds: activity.moving_time,
      averageHeartRate: activity.average_heartrate ?? null,
      maxHeartRate: activity.max_heartrate ?? null,
      averageCadence: isRun(activity)
        ? normalizeRunningCadence(activity.average_cadence)
        : activity.average_cadence ?? null,
    })),
  }))
  const record: CachedRecommendation = {
    date,
    createdAt: new Date().toISOString(),
    activityWatermark: watermark,
    recommendation,
  }
  localStorage.setItem(`${COACHING_CACHE_PREFIX}${date}`, JSON.stringify(record))
  return recommendation
}

export function getCachedCoachingRecommendation(date = localDateKey()): CachedRecommendation | null {
  if (typeof localStorage === 'undefined') return null
  const key = `${COACHING_CACHE_PREFIX}${date}`
  const value = localStorage.getItem(key)
  if (!value) return null
  try {
    return cachedRecommendationSchema.parse(JSON.parse(value))
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export function clearCoachingRecommendationCache(): void {
  if (typeof localStorage === 'undefined') return
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (key?.startsWith(COACHING_CACHE_PREFIX)) localStorage.removeItem(key)
  }
}

export async function getActivityDescription(
  activity: StravaActivityDetail,
  profile: AthleteProfile,
): Promise<string> {
  const database = await openRunAroundDb()
  const cached = await database.get('descriptions', activity.id)
  if (cached) return cached.description

  const generated = activityDescriptionSchema.parse(await sameOriginPost('/api/gemini', {
    operation: 'activityDescription',
    profile,
    activity: activityAssessmentInputSchema.parse({
      date: activity.start_date_local.slice(0, 10),
      sportType: activity.sport_type ?? activity.type,
      distanceMeters: activity.distance,
      movingTimeSeconds: activity.moving_time,
      elapsedTimeSeconds: activity.elapsed_time,
      elevationGainMeters: activity.total_elevation_gain,
      averageHeartRate: activity.average_heartrate ?? null,
      maxHeartRate: activity.max_heartrate ?? null,
      averageCadence: isRun(activity)
        ? normalizeRunningCadence(activity.average_cadence)
        : activity.average_cadence ?? null,
      calories: activity.calories ?? null,
      averageWatts: activity.average_watts ?? null,
      sufferScore: activity.suffer_score ?? null,
    }),
  }))
  await database.put('descriptions', {
    activityId: activity.id,
    description: generated.assessment,
    createdAt: new Date().toISOString(),
  })
  return generated.assessment
}
