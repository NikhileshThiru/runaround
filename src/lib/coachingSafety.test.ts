import { describe, expect, it } from 'vitest'
import type { AthleteProfile } from '@/schemas/athleteProfile'
import { coachingConstraints, validateRecommendationSafety } from './coachingSafety'

function profile(overrides: Partial<AthleteProfile> = {}): AthleteProfile {
  return {
    lastUpdated: '2026-06-09T00:00:00Z',
    lifetimeStats: {
      lifetimeMovementMiles: 100, lifetimeHours: 20, totalRunMiles: 80,
      totalCycleMiles: 20, totalRunCount: 10, totalActivityCount: 12,
    },
    fitness: { ctl: 30, atl: 35, form: -5, ctlTrend: 'maintaining', history: [] },
    runningMetrics: {
      avgCadenceLast30Days: 164, cadenceTrend: 'stable', cadenceBaseline90Days: 164,
      avgEasyPaceLast30Days: 600, avgHRLast30Days: 140, observedMaxHR180Days: 190,
      typicalWeeklyMiles: 30, weeklyBaselineSufficient: true, weeklyMileageHistory: [], dailyRunningHistory: [],
    },
    personalBests: { mile: null, fiveK: null, tenK: null, halfMarathon: null, marathon: null },
    recentLoad: {
      last7DaysMiles: 20, last14DaysMiles: 40, last30DaysMiles: 80, currentWeekMiles: 20,
      daysSinceLastRun: 1, daysSinceLastLongRun: 8, lastActivityType: 'Run',
      lastActivityIntensity: 'easy', lastHardEffortAt: null,
    },
    coachingFlags: {
      undertrained: false, overtraining: false, longRunOverdue: false,
      hardEffortWithin48Hours: false, formBelowSafetyFloor: false,
    },
    ...overrides,
  }
}

describe('coaching safety', () => {
  it('calculates the remaining weekly mileage allowance', () => {
    expect(coachingConstraints(profile()).maximumSafeDistanceMiles).toBe(13)
  })

  it('forces rest below the form safety floor', () => {
    const unsafe = profile({
      fitness: { ctl: 20, atl: 45, form: -25, ctlTrend: 'declining', history: [] },
      coachingFlags: {
        undertrained: false, overtraining: true, longRunOverdue: false,
        hardEffortWithin48Hours: false, formBelowSafetyFloor: true,
      },
    })
    const result = validateRecommendationSafety({
      sessionType: 'Intervals', distanceOrDuration: '6 miles', targetEffort: 'Hard',
      focus: 'Run fast', reason: 'Generated', intensity: 'hard',
    }, unsafe)
    expect(result.intensity).toBe('rest')
  })

  it('rejects hard sessions within 48 hours and mileage above the cap', () => {
    const recentHard = profile({
      coachingFlags: {
        undertrained: false, overtraining: false, longRunOverdue: false,
        hardEffortWithin48Hours: true, formBelowSafetyFloor: false,
      },
    })
    const hard = validateRecommendationSafety({
      sessionType: 'Tempo', distanceOrDuration: '5 miles', targetEffort: 'Hard',
      focus: 'Threshold', reason: 'Generated', intensity: 'hard',
    }, recentHard)
    expect(hard.intensity).toBe('easy')

    const tooLong = validateRecommendationSafety({
      sessionType: 'Long run', distanceOrDuration: '20 miles', targetEffort: 'Easy',
      focus: 'Steady', reason: 'Generated', intensity: 'easy',
    }, profile())
    expect(tooLong.distanceOrDuration).toContain('13.0')
  })
})
