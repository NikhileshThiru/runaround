import type { PublicSnapshot } from '@/schemas/publicSnapshot'
import type { StravaActivitySummary } from '@/schemas/strava'
import { activityIntensityAssessment, isRun, normalizeRunningCadence } from './athleteProfile'

export type DisplayActivity = PublicSnapshot['recentActivities'][number]

const METERS_PER_MILE = 1609.344

export function formatPace(secondsPerMile: number | null): string {
  if (!secondsPerMile || !Number.isFinite(secondsPerMile)) return '—'
  // Round the total first so 539.7 s renders as 9:00 rather than 8:60.
  const total = Math.round(secondsPerMile)
  const minutes = Math.floor(total / 60)
  const seconds = (total % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}/mi`
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`
}

/**
 * Converts a Strava sport_type identifier into a readable label, e.g.
 * "TrailRun" → "Trail Run" and "EMountainBikeRide" → "E-Mountain Bike Ride".
 */
export function formatSportName(sportType: string): string {
  return sportType
    .replace(/^E(?=[A-Z])/, 'E-')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .trim()
}

/**
 * Maps every Strava sport_type onto a small accent palette by category so any
 * activity the owner records — including ones never logged before — renders
 * with a sensible color. Matching is keyword-based rather than an exhaustive
 * enum so future Strava sport types degrade gracefully to a category.
 */
export function sportAccentColor(sportType: string): string {
  const type = sportType.toLowerCase()
  if (type.includes('run')) return '#27c0e8'
  if (type.includes('ride') || type.includes('cycle') || type.includes('velomobile')) return '#56d8a4'
  if (/tennis|pickle|badminton|squash|racquet/.test(type)) return '#ffb454'
  if (/swim|row|kayak|canoe|surf|paddl|sail|kitesurf|windsurf|water/.test(type)) return '#6d9ef7'
  if (/ski|snowboard|skate|snowshoe|ice/.test(type)) return '#b7e7f7'
  if (/weight|crossfit|interval|workout|yoga|pilates|elliptical|stair|climb/.test(type)) return '#f47867'
  if (/walk|hike|golf/.test(type)) return '#a3c98b'
  return '#8a94a0'
}

export function localActivitySummary(activity: StravaActivitySummary): string {
  const type = formatSportName(activity.sport_type ?? activity.type).toLowerCase()
  const miles = activity.distance / METERS_PER_MILE
  if (isRun(activity) && miles > 0) {
    return `${miles.toFixed(1)} mile run at ${formatPace(activity.moving_time / miles)}.`
  }
  if (miles > 0) return `${miles.toFixed(1)} miles of ${type} in ${formatDuration(activity.moving_time)}.`
  return `${formatDuration(activity.moving_time)} of ${type}.`
}

export function toDisplayActivity(
  activity: StravaActivitySummary,
  history: readonly StravaActivitySummary[] = [activity],
): DisplayActivity {
  const miles = activity.distance > 0 ? activity.distance / METERS_PER_MILE : null
  const intensity = activityIntensityAssessment(activity, history)
  return {
    id: `owner-${activity.id}`,
    date: activity.start_date_local.slice(0, 10),
    sportType: activity.sport_type ?? activity.type,
    distanceMiles: miles,
    durationSeconds: activity.moving_time,
    averagePaceSecondsPerMile: isRun(activity) && miles ? activity.moving_time / miles : null,
    averageHeartRate: activity.average_heartrate ?? null,
    averageCadence: isRun(activity)
      ? normalizeRunningCadence(activity.average_cadence)
      : activity.average_cadence ?? null,
    intensity: intensity.intensity,
    intensityBasis: intensity.basis,
    summary: localActivitySummary(activity),
  }
}
