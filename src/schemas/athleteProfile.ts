import { z } from 'zod'

export const effortIntensitySchema = z.enum(['easy', 'moderate', 'hard'])
export type EffortIntensity = z.infer<typeof effortIntensitySchema>

export const personalBestDistanceSchema = z.enum(['mile', 'fiveK', 'tenK', 'halfMarathon', 'marathon'])
export type PersonalBestDistance = z.infer<typeof personalBestDistanceSchema>

export const personalBestSchema = z.object({
  elapsedSeconds: z.number().int().positive(),
  distanceMeters: z.number().positive(),
  activityId: z.number().int().positive(),
  effortName: z.string(),
})

export const personalBestsSchema = z.record(personalBestDistanceSchema, personalBestSchema.nullable())

export const pbScanStateSchema = z.object({
  status: z.enum(['not_started', 'scanning', 'complete', 'error']),
  scannedActivityIds: z.array(z.number().int().positive()),
  totalRunCount: z.number().int().nonnegative(),
  bests: personalBestsSchema,
  error: z.string().optional(),
  updatedAt: z.string().datetime(),
})

export const athleteProfileSchema = z.object({
  lastUpdated: z.string().datetime(),
  lifetimeStats: z.object({
    lifetimeMovementMiles: z.number().nonnegative(),
    lifetimeHours: z.number().nonnegative(),
    totalRunMiles: z.number().nonnegative(),
    totalCycleMiles: z.number().nonnegative(),
    totalRunCount: z.number().int().nonnegative(),
    totalActivityCount: z.number().int().nonnegative(),
  }),
  fitness: z.object({
    ctl: z.number(),
    atl: z.number(),
    form: z.number(),
    ctlTrend: z.enum(['building', 'maintaining', 'declining']),
    history: z.array(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      ctl: z.number(),
      atl: z.number(),
      form: z.number(),
    })).max(84),
  }),
  runningMetrics: z.object({
    avgCadenceLast30Days: z.number().nullable(),
    cadenceTrend: z.enum(['improving', 'declining', 'stable', 'insufficient']),
    cadenceBaseline90Days: z.number().nullable(),
    avgEasyPaceLast30Days: z.number().nullable(),
    avgHRLast30Days: z.number().nullable(),
    observedMaxHR180Days: z.number().nullable(),
    typicalWeeklyMiles: z.number().nullable(),
    weeklyBaselineSufficient: z.boolean(),
    weeklyMileageHistory: z.array(z.object({ weekStart: z.string(), miles: z.number().nonnegative() })).max(12),
    dailyRunningHistory: z.array(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      paceSecondsPerMile: z.number().positive().nullable(),
      averageHeartRate: z.number().positive().nullable(),
      cadence: z.number().positive().nullable(),
    })).max(100),
  }),
  personalBests: personalBestsSchema,
  recentLoad: z.object({
    last7DaysMiles: z.number().nonnegative(),
    last14DaysMiles: z.number().nonnegative(),
    last30DaysMiles: z.number().nonnegative(),
    currentWeekMiles: z.number().nonnegative(),
    daysSinceLastRun: z.number().nonnegative().nullable(),
    daysSinceLastLongRun: z.number().nonnegative().nullable(),
    lastActivityType: z.string().nullable(),
    lastActivityIntensity: effortIntensitySchema.nullable(),
    lastHardEffortAt: z.string().datetime().nullable(),
  }),
  coachingFlags: z.object({
    undertrained: z.boolean(),
    overtraining: z.boolean(),
    longRunOverdue: z.boolean(),
    hardEffortWithin48Hours: z.boolean(),
    formBelowSafetyFloor: z.boolean(),
  }),
})

export type PersonalBest = z.infer<typeof personalBestSchema>
export type PersonalBests = z.infer<typeof personalBestsSchema>
export type PbScanState = z.infer<typeof pbScanStateSchema>
export type AthleteProfile = z.infer<typeof athleteProfileSchema>
