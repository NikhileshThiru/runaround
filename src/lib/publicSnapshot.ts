import type { CoachingRecommendation } from '@/schemas/ai'
import type { AthleteProfile, PersonalBests } from '@/schemas/athleteProfile'
import { publicSnapshotSchema, type PublicSnapshot } from '@/schemas/publicSnapshot'
import type { StravaActivitySummary } from '@/schemas/strava'
import { activityIntensityAssessment, isRun, normalizeRunningCadence } from './athleteProfile'
import type { ActivityChartSeries } from './activityCharts'

const METERS_PER_MILE = 1609.344

export interface PublicSnapshotInput {
  profile: AthleteProfile
  activities: readonly StravaActivitySummary[]
  coaching: CoachingRecommendation | null
  loadTrend?: PublicSnapshot['trends']['load']
  chartsByActivityId?: ReadonlyMap<number, ActivityChartSeries>
  now?: Date
}

function publicBests(bests: PersonalBests): PublicSnapshot['stats']['personalBests'] {
  return Object.fromEntries(Object.entries(bests).map(([key, best]) => [
    key,
    best ? { elapsedSeconds: best.elapsedSeconds, distanceMeters: best.distanceMeters } : null,
  ])) as PublicSnapshot['stats']['personalBests']
}

function deterministicSummary(activity: StravaActivitySummary): string {
  const type = activity.sport_type ?? activity.type
  const miles = activity.distance / METERS_PER_MILE
  const minutes = Math.round(activity.moving_time / 60)
  if (isRun(activity) && miles > 0) {
    const pace = Math.round(activity.moving_time / miles)
    const paceMinutes = Math.floor(pace / 60)
    const paceSeconds = (pace % 60).toString().padStart(2, '0')
    return `${miles.toFixed(1)} mile run at ${paceMinutes}:${paceSeconds} per mile.`
  }
  if (miles > 0) return `${miles.toFixed(1)} miles of ${type.toLowerCase()} in ${minutes} minutes.`
  return `${minutes} minutes of ${type.toLowerCase()}.`
}

function opaqueSnapshotId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16)
}

export function createPublicSnapshot(input: PublicSnapshotInput): PublicSnapshot {
  const sorted = [...input.activities].sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date))
  const runs = sorted.filter(isRun)
  const longestRunMiles = Math.max(0, ...runs.map((activity) => activity.distance / METERS_PER_MILE))
  const weeklyBaseline = input.profile.runningMetrics.typicalWeeklyMiles

  const snapshot: PublicSnapshot = {
    version: 1,
    publishedAt: (input.now ?? new Date()).toISOString(),
    stats: {
      lifetimeMovementMiles: input.profile.lifetimeStats.lifetimeMovementMiles,
      lifetimeHours: input.profile.lifetimeStats.lifetimeHours,
      runCount: input.profile.lifetimeStats.totalRunCount,
      longestRunMiles,
      personalBests: publicBests(input.profile.personalBests),
    },
    coaching: input.coaching,
    trends: {
      weeklyMileage: input.profile.runningMetrics.weeklyMileageHistory.map((week) => ({
        ...week,
        baseline: weeklyBaseline,
      })),
      load: input.loadTrend ?? input.profile.fitness.history,
      running: input.profile.runningMetrics.dailyRunningHistory,
    },
    recentActivities: sorted.slice(0, 12).map((activity) => {
      const miles = activity.distance > 0 ? activity.distance / METERS_PER_MILE : null
      const cadence = isRun(activity) ? normalizeRunningCadence(activity.average_cadence) : activity.average_cadence ?? null
      const intensity = activityIntensityAssessment(activity, sorted)
      const charts = input.chartsByActivityId?.get(activity.id)
      return {
        id: opaqueSnapshotId(),
        date: activity.start_date_local.slice(0, 10),
        sportType: activity.sport_type ?? activity.type,
        distanceMiles: miles,
        durationSeconds: activity.moving_time,
        averagePaceSecondsPerMile: isRun(activity) && miles ? activity.moving_time / miles : null,
        averageHeartRate: activity.average_heartrate ?? null,
        averageCadence: cadence,
        intensity: intensity.intensity,
        intensityBasis: intensity.basis,
        summary: deterministicSummary(activity),
        charts: charts ? {
          pace: charts.pace.filter(hasValue).map((point) => ({ index: point.index, value: point.value })),
          heartRate: charts.heartRate.filter(hasValue).map((point) => ({ index: point.index, value: point.value })),
          cadence: charts.cadence.filter(hasValue).map((point) => ({ index: point.index, value: point.value })),
        } : undefined,
      }
    }),
  }

  return publicSnapshotSchema.parse(snapshot)
}

function hasValue(point: { index: number; value: number | null }): point is { index: number; value: number } {
  return point.value !== null
}

export function serializePublicSnapshot(snapshot: PublicSnapshot): string {
  return `${JSON.stringify(publicSnapshotSchema.parse(snapshot), null, 2)}\n`
}
