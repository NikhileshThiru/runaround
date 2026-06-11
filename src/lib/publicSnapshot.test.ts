import { describe, expect, it, vi } from 'vitest'
import type { AthleteProfile } from '@/schemas/athleteProfile'
import { createPublicSnapshot } from './publicSnapshot'

const profile: AthleteProfile = {
  lastUpdated: '2026-06-09T00:00:00.000Z',
  lifetimeStats: {
    lifetimeMovementMiles: 100,
    lifetimeHours: 20,
    totalRunMiles: 80,
    totalCycleMiles: 20,
    totalRunCount: 10,
    totalActivityCount: 12,
  },
  fitness: { ctl: 10, atl: 8, form: 2, ctlTrend: 'building', history: [] },
  runningMetrics: {
    avgCadenceLast30Days: 165,
    cadenceTrend: 'stable',
    cadenceBaseline90Days: 164,
    avgEasyPaceLast30Days: 600,
    avgHRLast30Days: 140,
    observedMaxHR180Days: 190,
    typicalWeeklyMiles: 25,
    weeklyBaselineSufficient: true,
    weeklyMileageHistory: [{ weekStart: '2026-06-01', miles: 24 }],
    dailyRunningHistory: [],
  },
  personalBests: {
    mile: { elapsedSeconds: 360, distanceMeters: 1609.344, activityId: 999, effortName: '1 mile' },
    fiveK: null,
    tenK: null,
    halfMarathon: null,
    marathon: null,
  },
  recentLoad: {
    last7DaysMiles: 20,
    last14DaysMiles: 40,
    last30DaysMiles: 80,
    currentWeekMiles: 8,
    daysSinceLastRun: 1,
    daysSinceLastLongRun: 8,
    lastActivityType: 'Run',
    lastActivityIntensity: 'easy',
    lastHardEffortAt: null,
  },
  coachingFlags: {
    undertrained: false,
    overtraining: false,
    longRunOverdue: false,
    hardEffortWithin48Hours: false,
    formBelowSafetyFloor: false,
  },
}

describe('public snapshot sanitization', () => {
  it('constructs public records without Strava IDs, names, coordinates, or source PB IDs', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '12345678-1234-1234-1234-123456789012' })
    const snapshot = createPublicSnapshot({
      profile,
      coaching: null,
      now: new Date('2026-06-09T00:00:00Z'),
      activities: [{
        id: 999,
        name: 'Private neighborhood run',
        type: 'Run',
        sport_type: 'Run',
        distance: 5000,
        moving_time: 1500,
        elapsed_time: 1600,
        total_elevation_gain: 20,
        start_date: '2026-06-08T12:34:56Z',
        start_date_local: '2026-06-08T08:34:56Z',
      }],
    })
    const serialized = JSON.stringify(snapshot)
    expect(serialized).not.toContain('999')
    expect(serialized).not.toContain('Private neighborhood run')
    expect(serialized).not.toContain('12:34:56')
    expect(snapshot.stats.personalBests.mile).toEqual({ elapsedSeconds: 360, distanceMeters: 1609.344 })
    expect(snapshot.recentActivities[0]?.id).toBe('1234567812341234')
  })
})
