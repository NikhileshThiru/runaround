import { describe, expect, it } from 'vitest'
import type { StravaActivitySummary } from '@/schemas/strava'
import {
  activityIntensityAssessment,
  classifyActivityIntensity,
  computeAthleteProfile,
  estimatedLoadScore,
  normalizeRunningCadence,
} from './athleteProfile'

function activity(overrides: Partial<StravaActivitySummary> = {}): StravaActivitySummary {
  return {
    id: 1,
    name: 'Run',
    type: 'Run',
    sport_type: 'Run',
    distance: 16093.44,
    moving_time: 3600,
    elapsed_time: 3600,
    total_elevation_gain: 0,
    start_date: '2026-06-07T12:00:00Z',
    start_date_local: '2026-06-07T08:00:00Z',
    ...overrides,
  }
}

describe('adaptive athlete profile', () => {
  it('normalizes Strava running cadence without changing step-based values', () => {
    expect(normalizeRunningCadence(82)).toBe(164)
    expect(normalizeRunningCadence(168)).toBe(168)
    expect(normalizeRunningCadence(undefined)).toBeNull()
  })

  it('uses observed max HR thresholds and treats missing HR conservatively', () => {
    expect(classifyActivityIntensity(activity({ average_heartrate: 170 }), 190, [])).toBe('hard')
    expect(classifyActivityIntensity(activity({ average_heartrate: 150 }), 190, [])).toBe('moderate')
    expect(classifyActivityIntensity(activity({ average_heartrate: 140 }), 190, [])).toBe('easy')
    expect(classifyActivityIntensity(activity({ average_heartrate: undefined }), 190, [])).toBe('easy')
  })

  it('explains the measured basis for the displayed effort classification', () => {
    const history = [activity({ average_heartrate: 170, max_heartrate: 190 })]
    expect(activityIntensityAssessment(history[0]!, history, new Date('2026-06-08T12:00:00Z'))).toEqual({
      intensity: 'hard',
      basis: '170 bpm is 89% of the observed 190 bpm maximum.',
    })
    expect(activityIntensityAssessment(activity({ average_heartrate: undefined }), history).basis).toContain('missing')
  })

  it('keeps estimated load scores on a consistent 100-point hourly scale', () => {
    expect(estimatedLoadScore(activity(), 'easy')).toBeCloseTo(65)
    expect(estimatedLoadScore(activity({ type: 'Ride', sport_type: 'Ride' }), 'easy')).toBeCloseTo(55)
    expect(estimatedLoadScore(activity({ type: 'Tennis', sport_type: 'Tennis' }), 'easy')).toBeCloseTo(45)
    expect(estimatedLoadScore(activity({ moving_time: 0 }), 'hard')).toBe(0)
  })

  it('includes inactive days in EWMA decay', () => {
    const profile = computeAthleteProfile([
      activity({
        start_date: '2026-05-09T12:00:00Z',
        start_date_local: '2026-05-09T08:00:00Z',
        average_heartrate: 175,
        max_heartrate: 190,
      }),
    ], undefined, new Date('2026-06-08T12:00:00Z'))
    expect(profile.fitness.ctl).toBeGreaterThan(0)
    expect(profile.fitness.atl).toBeGreaterThan(0)
    expect(profile.fitness.form).toBeGreaterThan(0)
  })

  it('uses the median of completed weeks, including zero-mile weeks after history starts', () => {
    const now = new Date('2026-06-09T12:00:00Z')
    const weeklyMiles = [10, 20, 30, 40, 50, 60]
    const activities = weeklyMiles.map((miles, index) => activity({
      id: index + 1,
      distance: miles * 1609.344,
      start_date: new Date(Date.UTC(2026, 3, 27 + index * 7, 12)).toISOString(),
      start_date_local: new Date(Date.UTC(2026, 3, 27 + index * 7, 8)).toISOString(),
    }))
    const profile = computeAthleteProfile(activities, undefined, now)
    expect(profile.runningMetrics.typicalWeeklyMiles).toBe(35)
    expect(profile.runningMetrics.weeklyBaselineSufficient).toBe(true)
    expect(profile.coachingFlags.undertrained).toBe(true)
  })

  it('counts every positive-distance activity toward Lifetime Movement', () => {
    const profile = computeAthleteProfile([
      activity({ id: 1, distance: 1609.344 }),
      activity({ id: 2, type: 'Ride', sport_type: 'Ride', distance: 3218.688 }),
      activity({ id: 3, type: 'Tennis', sport_type: 'Tennis', distance: 0 }),
    ], undefined, new Date('2026-06-08T12:00:00Z'))
    expect(profile.lifetimeStats.lifetimeMovementMiles).toBe(3)
    expect(profile.lifetimeStats.totalRunMiles).toBe(1)
    expect(profile.lifetimeStats.totalCycleMiles).toBe(2)
  })
})
