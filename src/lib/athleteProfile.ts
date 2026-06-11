import type { AthleteProfile, EffortIntensity, PbScanState } from '@/schemas/athleteProfile'
import type { StravaActivitySummary } from '@/schemas/strava'
import { emptyPersonalBests } from './personalBests'

const METERS_PER_MILE = 1609.344
const DAY_MS = 24 * 60 * 60 * 1000

interface ClassifiedActivity {
  activity: StravaActivitySummary
  intensity: EffortIntensity
  load: number
  miles: number
  dateKey: string
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!
}

function percentile(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!
}

function dateKey(activity: StravaActivitySummary): string {
  return activity.start_date_local.slice(0, 10)
}

function utcDateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`)
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function startOfUtcMonday(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const mondayIndex = (start.getUTCDay() + 6) % 7
  return addDays(start, -mondayIndex)
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.max(0, (later.getTime() - earlier.getTime()) / DAY_MS)
}

export function isRun(activity: StravaActivitySummary): boolean {
  return (activity.sport_type ?? activity.type).toLowerCase().includes('run')
}

function isRide(activity: StravaActivitySummary): boolean {
  const type = (activity.sport_type ?? activity.type).toLowerCase()
  return type.includes('ride') || type.includes('cycle')
}

export function normalizeRunningCadence(cadence: number | null | undefined): number | null {
  if (cadence === null || cadence === undefined || cadence <= 0) return null
  return cadence < 120 ? cadence * 2 : cadence
}

function observedMaxHeartRate(activities: readonly StravaActivitySummary[], now: Date): number | null {
  const threshold = now.getTime() - 180 * DAY_MS
  const values = activities
    .filter(isRun)
    .filter((activity) => new Date(activity.start_date).getTime() >= threshold)
    .flatMap((activity) => {
      const value = activity.max_heartrate
      return value !== null && value !== undefined && value >= 100 && value <= 230 ? [value] : []
    })
  return values.length ? Math.max(...values) : null
}

function heartRateDistribution(activities: readonly StravaActivitySummary[], now: Date): number[] {
  const threshold = now.getTime() - 90 * DAY_MS
  return activities
    .filter(isRun)
    .filter((activity) => new Date(activity.start_date).getTime() >= threshold)
    .flatMap((activity) => activity.average_heartrate ? [activity.average_heartrate] : [])
}

export function classifyActivityIntensity(
  activity: StravaActivitySummary,
  observedMaxHr: number | null,
  distribution: readonly number[],
): EffortIntensity {
  const averageHr = activity.average_heartrate
  if (!averageHr) return 'easy'

  if (observedMaxHr) {
    const ratio = averageHr / observedMaxHr
    if (ratio > 0.88) return 'hard'
    if (ratio >= 0.78) return 'moderate'
    return 'easy'
  }

  if (distribution.length < 10) return 'easy'

  const moderateThreshold = percentile(distribution, 0.6)
  const hardThreshold = percentile(distribution, 0.85)
  if (hardThreshold !== null && averageHr >= hardThreshold) return 'hard'
  if (moderateThreshold !== null && averageHr >= moderateThreshold) return 'moderate'
  return 'easy'
}

export function activityIntensityAssessment(
  activity: StravaActivitySummary,
  history: readonly StravaActivitySummary[],
  now = new Date(),
): { intensity: EffortIntensity; basis: string } {
  const maxHeartRate = observedMaxHeartRate(history, now)
  const distribution = heartRateDistribution(history, now)
  const intensity = classifyActivityIntensity(activity, maxHeartRate, distribution)
  const averageHeartRate = activity.average_heartrate

  if (!averageHeartRate) {
    return { intensity, basis: 'Average heart rate is missing, so this uses the conservative easy classification.' }
  }
  if (maxHeartRate) {
    return {
      intensity,
      basis: `${Math.round(averageHeartRate)} bpm is ${Math.round((averageHeartRate / maxHeartRate) * 100)}% of the observed ${Math.round(maxHeartRate)} bpm maximum.`,
    }
  }
  if (distribution.length >= 10) {
    return {
      intensity,
      basis: `${Math.round(averageHeartRate)} bpm is classified against the trailing 90-day running heart-rate distribution.`,
    }
  }
  return {
    intensity,
    basis: 'Heart-rate history is insufficient, so this uses the conservative easy classification.',
  }
}

export function estimatedLoadScore(
  activity: StravaActivitySummary,
  intensity: EffortIntensity,
): number {
  if (activity.moving_time <= 0) return 0
  const hours = activity.moving_time / 3600
  if (isRun(activity)) {
    const relativeIntensity = intensity === 'hard' ? 1 : intensity === 'moderate' ? 0.85 : 0.65
    return hours * relativeIntensity * 100
  }
  return hours * (isRide(activity) ? 0.55 : 0.45) * 100
}

function classifyActivities(activities: readonly StravaActivitySummary[], now: Date): ClassifiedActivity[] {
  const maxHr = observedMaxHeartRate(activities, now)
  const distribution = heartRateDistribution(activities, now)
  return activities.map((activity) => {
    const intensity = classifyActivityIntensity(activity, maxHr, distribution)
    return {
      activity,
      intensity,
      load: estimatedLoadScore(activity, intensity),
      miles: activity.distance / METERS_PER_MILE,
      dateKey: dateKey(activity),
    }
  })
}

function computeLoadSeries(classified: readonly ClassifiedActivity[], now: Date) {
  const dailyLoads = new Map<string, number>()
  for (const item of classified) {
    dailyLoads.set(item.dateKey, (dailyLoads.get(item.dateKey) ?? 0) + item.load)
  }

  const firstDate = classified.length
    ? utcDateFromKey([...classified].sort((a, b) => a.dateKey.localeCompare(b.dateKey))[0]!.dateKey)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const history: { date: string; ctl: number; atl: number; form: number }[] = []
  let ctl = 0
  let atl = 0

  for (let date = firstDate; date <= endDate; date = addDays(date, 1)) {
    const key = formatDateKey(date)
    const load = dailyLoads.get(key) ?? 0
    ctl += (load - ctl) / 42
    atl += (load - atl) / 7
    history.push({ date: key, ctl, atl, form: ctl - atl })
  }
  return history
}

function weeklyMileage(classified: readonly ClassifiedActivity[], now: Date) {
  const currentMonday = startOfUtcMonday(now)
  const earliestActivityDate = classified.length
    ? utcDateFromKey([...classified].sort((a, b) => a.dateKey.localeCompare(b.dateKey))[0]!.dateKey)
    : null
  const weeks = Array.from({ length: 12 }, (_, index) => {
    const start = addDays(currentMonday, -(index + 1) * 7)
    const end = addDays(start, 7)
    const miles = classified
      .filter((item) => {
        const date = utcDateFromKey(item.dateKey)
        return date >= start && date < end
      })
      .reduce((sum, item) => sum + (isRun(item.activity) ? item.miles : 0), 0)
    return { weekStart: formatDateKey(start), miles: round(miles) }
  }).reverse()

  const availableWeeks = earliestActivityDate
    ? weeks.filter((week) => addDays(utcDateFromKey(week.weekStart), 7) > earliestActivityDate)
    : []
  const baselineWeeks = availableWeeks.slice(-6)
  const baselineSufficient = baselineWeeks.length >= 2
  const baseline = baselineSufficient ? median(baselineWeeks.map((week) => week.miles)) : null
  const currentWeekMiles = classified
    .filter((item) => isRun(item.activity) && utcDateFromKey(item.dateKey) >= currentMonday)
    .reduce((sum, item) => sum + item.miles, 0)

  return { weeks, baseline, baselineSufficient, currentWeekMiles }
}

function milesWithinDays(classified: readonly ClassifiedActivity[], now: Date, days: number): number {
  const threshold = now.getTime() - days * DAY_MS
  return classified
    .filter((item) => isRun(item.activity) && new Date(item.activity.start_date).getTime() >= threshold)
    .reduce((sum, item) => sum + item.miles, 0)
}

function cadenceTrend(recent: readonly number[], previous: readonly number[]): AthleteProfile['runningMetrics']['cadenceTrend'] {
  const recentAverage = average(recent)
  const previousAverage = average(previous)
  if (recentAverage === null || previousAverage === null) return 'insufficient'
  const difference = recentAverage - previousAverage
  if (difference > 2) return 'improving'
  if (difference < -2) return 'declining'
  return 'stable'
}

export function computeAthleteProfile(
  activities: readonly StravaActivitySummary[],
  pbScan?: PbScanState,
  now = new Date(),
): AthleteProfile {
  const sorted = [...activities].sort((left, right) => Date.parse(right.start_date) - Date.parse(left.start_date))
  const classified = classifyActivities(sorted, now)
  const maxHr = observedMaxHeartRate(sorted, now)
  const loadHistory = computeLoadSeries(classified, now)
  const latestLoad = loadHistory.at(-1) ?? { ctl: 0, atl: 0, form: 0 }
  const twoWeeksAgo = loadHistory.at(-15)?.ctl ?? latestLoad.ctl
  const ctlDifference = latestLoad.ctl - twoWeeksAgo
  const weekly = weeklyMileage(classified, now)

  const thirtyDayThreshold = now.getTime() - 30 * DAY_MS
  const sixtyDayThreshold = now.getTime() - 60 * DAY_MS
  const ninetyDayThreshold = now.getTime() - 90 * DAY_MS
  const recentRuns = classified.filter((item) => isRun(item.activity) && Date.parse(item.activity.start_date) >= thirtyDayThreshold)
  const recentCadence = recentRuns.flatMap((item) => {
    const cadence = normalizeRunningCadence(item.activity.average_cadence)
    return cadence === null ? [] : [cadence]
  })
  const previousCadence = classified
    .filter((item) => isRun(item.activity))
    .filter((item) => {
      const timestamp = Date.parse(item.activity.start_date)
      return timestamp >= sixtyDayThreshold && timestamp < thirtyDayThreshold
    })
    .flatMap((item) => {
      const cadence = normalizeRunningCadence(item.activity.average_cadence)
      return cadence === null ? [] : [cadence]
    })
  const baselineCadence = classified
    .filter((item) => isRun(item.activity) && Date.parse(item.activity.start_date) >= ninetyDayThreshold)
    .flatMap((item) => {
      const cadence = normalizeRunningCadence(item.activity.average_cadence)
      return cadence === null ? [] : [cadence]
    })
  const easyPaces = recentRuns
    .filter((item) => item.intensity === 'easy' && item.miles > 0)
    .map((item) => item.activity.moving_time / item.miles)
  const recentHr = recentRuns.flatMap((item) => item.activity.average_heartrate ? [item.activity.average_heartrate] : [])
  const dailyRunningHistory = [...recentRuns]
    .sort((left, right) => Date.parse(left.activity.start_date) - Date.parse(right.activity.start_date))
    .map((item) => ({
      date: item.dateKey,
      paceSecondsPerMile: item.miles > 0 ? round(item.activity.moving_time / item.miles) : null,
      averageHeartRate: item.activity.average_heartrate ? round(item.activity.average_heartrate) : null,
      cadence: normalizeRunningCadence(item.activity.average_cadence),
    }))

  const runs = classified.filter((item) => isRun(item.activity))
  const rides = classified.filter((item) => isRide(item.activity))
  const latestRun = runs[0]
  const latestLongRun = runs.find((item) => item.miles > 10)
  const latestHard = classified.find((item) => item.intensity === 'hard')
  const daysSinceLastRun = latestRun ? daysBetween(new Date(latestRun.activity.start_date), now) : null
  const daysSinceLastLongRun = latestLongRun ? daysBetween(new Date(latestLongRun.activity.start_date), now) : null
  const hardEffortWithin48Hours = latestHard
    ? now.getTime() - Date.parse(latestHard.activity.start_date) < 48 * 60 * 60 * 1000
    : false
  const last7DaysMiles = milesWithinDays(classified, now, 7)

  return {
    lastUpdated: now.toISOString(),
    lifetimeStats: {
      lifetimeMovementMiles: round(classified.reduce((sum, item) => sum + Math.max(0, item.miles), 0)),
      lifetimeHours: round(sorted.reduce((sum, activity) => sum + Math.max(0, activity.moving_time), 0) / 3600),
      totalRunMiles: round(runs.reduce((sum, item) => sum + item.miles, 0)),
      totalCycleMiles: round(rides.reduce((sum, item) => sum + item.miles, 0)),
      totalRunCount: runs.length,
      totalActivityCount: sorted.length,
    },
    fitness: {
      ctl: round(latestLoad.ctl),
      atl: round(latestLoad.atl),
      form: round(latestLoad.form),
      ctlTrend: ctlDifference > 1 ? 'building' : ctlDifference < -1 ? 'declining' : 'maintaining',
      history: loadHistory.slice(-84).map((point) => ({
        date: point.date,
        ctl: round(point.ctl),
        atl: round(point.atl),
        form: round(point.form),
      })),
    },
    runningMetrics: {
      avgCadenceLast30Days: average(recentCadence) === null ? null : round(average(recentCadence)!),
      cadenceTrend: cadenceTrend(recentCadence, previousCadence),
      cadenceBaseline90Days: average(baselineCadence) === null ? null : round(average(baselineCadence)!),
      avgEasyPaceLast30Days: average(easyPaces) === null ? null : round(average(easyPaces)!),
      avgHRLast30Days: average(recentHr) === null ? null : round(average(recentHr)!),
      observedMaxHR180Days: maxHr,
      typicalWeeklyMiles: weekly.baseline === null ? null : round(weekly.baseline),
      weeklyBaselineSufficient: weekly.baselineSufficient,
      weeklyMileageHistory: weekly.weeks,
      dailyRunningHistory,
    },
    personalBests: pbScan?.bests ?? emptyPersonalBests(),
    recentLoad: {
      last7DaysMiles: round(last7DaysMiles),
      last14DaysMiles: round(milesWithinDays(classified, now, 14)),
      last30DaysMiles: round(milesWithinDays(classified, now, 30)),
      currentWeekMiles: round(weekly.currentWeekMiles),
      daysSinceLastRun: daysSinceLastRun === null ? null : round(daysSinceLastRun, 1),
      daysSinceLastLongRun: daysSinceLastLongRun === null ? null : round(daysSinceLastLongRun, 1),
      lastActivityType: sorted[0]?.sport_type ?? sorted[0]?.type ?? null,
      lastActivityIntensity: classified[0]?.intensity ?? null,
      lastHardEffortAt: latestHard?.activity.start_date ?? null,
    },
    coachingFlags: {
      undertrained: weekly.baselineSufficient && weekly.baseline !== null && last7DaysMiles < weekly.baseline * 0.6,
      overtraining: weekly.baselineSufficient && weekly.baseline !== null && last7DaysMiles > weekly.baseline * 1.1,
      longRunOverdue: daysSinceLastLongRun !== null && daysSinceLastLongRun > 10,
      hardEffortWithin48Hours,
      formBelowSafetyFloor: latestLoad.form < -20,
    },
  }
}
