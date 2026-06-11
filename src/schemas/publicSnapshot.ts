import { z } from 'zod'
import { coachingRecommendationSchema } from './ai'

const chartPointSchema = z.object({
  index: z.number().int().nonnegative(),
  value: z.number().finite(),
})

const publicPersonalBestSchema = z.object({
  elapsedSeconds: z.number().int().positive(),
  distanceMeters: z.number().positive(),
}).nullable()

const publicPersonalBestsSchema = z.object({
  mile: publicPersonalBestSchema,
  fiveK: publicPersonalBestSchema,
  tenK: publicPersonalBestSchema,
  halfMarathon: publicPersonalBestSchema,
  marathon: publicPersonalBestSchema,
})

export const publicActivitySchema = z.object({
  id: z.string().min(8),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sportType: z.string().min(1),
  distanceMiles: z.number().nonnegative().nullable(),
  durationSeconds: z.number().int().nonnegative(),
  averagePaceSecondsPerMile: z.number().positive().nullable(),
  averageHeartRate: z.number().positive().nullable(),
  averageCadence: z.number().positive().nullable(),
  intensity: z.enum(['easy', 'moderate', 'hard']).optional(),
  intensityBasis: z.string().min(1).max(180).optional(),
  summary: z.string().min(1).max(180),
  charts: z.object({
    pace: z.array(chartPointSchema).max(240).optional(),
    heartRate: z.array(chartPointSchema).max(240).optional(),
    cadence: z.array(chartPointSchema).max(240).optional(),
  }).optional(),
})

const weeklyMileagePointSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  miles: z.number().nonnegative(),
  baseline: z.number().nonnegative().nullable(),
})

const loadPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ctl: z.number(),
  atl: z.number(),
  form: z.number(),
})

const runningTrendPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paceSecondsPerMile: z.number().positive().nullable(),
  averageHeartRate: z.number().positive().nullable(),
  cadence: z.number().positive().nullable(),
})

export const publicSnapshotSchema = z.object({
  version: z.literal(1),
  publishedAt: z.string().datetime(),
  stats: z.object({
    lifetimeMovementMiles: z.number().nonnegative(),
    lifetimeHours: z.number().nonnegative(),
    runCount: z.number().int().nonnegative(),
    longestRunMiles: z.number().nonnegative(),
    personalBests: publicPersonalBestsSchema,
  }),
  coaching: coachingRecommendationSchema.nullable(),
  trends: z.object({
    weeklyMileage: z.array(weeklyMileagePointSchema).max(12),
    load: z.array(loadPointSchema).max(84),
    running: z.array(runningTrendPointSchema).max(100),
  }),
  recentActivities: z.array(publicActivitySchema).max(12),
})

export type PublicSnapshot = z.infer<typeof publicSnapshotSchema>
