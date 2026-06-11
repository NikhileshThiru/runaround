import { z } from 'zod'

const nullableMetric = z.number().finite().nullable()

export const coachingActivityInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sportType: z.string().min(1).max(80),
  distanceMeters: z.number().finite().nonnegative(),
  movingTimeSeconds: z.number().int().nonnegative(),
  averageHeartRate: nullableMetric,
  maxHeartRate: nullableMetric,
  averageCadence: nullableMetric,
}).strict()

export const activityAssessmentInputSchema = coachingActivityInputSchema.extend({
  elapsedTimeSeconds: z.number().int().nonnegative(),
  elevationGainMeters: z.number().finite().nonnegative(),
  calories: nullableMetric,
  averageWatts: nullableMetric,
  sufferScore: nullableMetric,
}).strict()

export const coachingRecommendationSchema = z.object({
  sessionType: z.string().min(1).max(80),
  distanceOrDuration: z.string().min(1).max(80),
  targetEffort: z.string().min(1).max(120),
  focus: z.string().min(1).max(120),
  reason: z.string().min(1).max(240),
  intensity: z.enum(['rest', 'easy', 'moderate', 'hard']),
})

export const activityDescriptionSchema = z.object({
  assessment: z.string().min(1).max(600),
})

export const cachedRecommendationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string().datetime(),
  activityWatermark: z.string().datetime().nullable(),
  recommendation: coachingRecommendationSchema,
})

export type CoachingRecommendation = z.infer<typeof coachingRecommendationSchema>
export type CachedRecommendation = z.infer<typeof cachedRecommendationSchema>
export type CoachingActivityInput = z.infer<typeof coachingActivityInputSchema>
export type ActivityAssessmentInput = z.infer<typeof activityAssessmentInputSchema>
