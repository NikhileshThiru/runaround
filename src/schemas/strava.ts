import { z } from 'zod'

const optionalMetric = z.number().finite().nullable().optional()

export const stravaActivitySummarySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  type: z.string(),
  sport_type: z.string().optional(),
  distance: z.number().finite().nonnegative().default(0),
  moving_time: z.number().int().nonnegative().default(0),
  elapsed_time: z.number().int().nonnegative().default(0),
  total_elevation_gain: z.number().finite().nonnegative().default(0),
  start_date: z.string().datetime(),
  start_date_local: z.string().min(10),
  timezone: z.string().optional(),
  average_speed: optionalMetric,
  max_speed: optionalMetric,
  average_heartrate: optionalMetric,
  max_heartrate: optionalMetric,
  average_cadence: optionalMetric,
  suffer_score: optionalMetric,
}).passthrough()

export const stravaBestEffortSchema = z.object({
  name: z.string(),
  distance: z.number().finite().positive(),
  elapsed_time: z.number().int().positive(),
  moving_time: z.number().int().positive().optional(),
  start_index: z.number().int().nonnegative().optional(),
  end_index: z.number().int().nonnegative().optional(),
}).passthrough()

export const stravaActivityDetailSchema = stravaActivitySummarySchema.extend({
  calories: optionalMetric,
  average_watts: optionalMetric,
  weighted_average_watts: optionalMetric,
  best_efforts: z.array(stravaBestEffortSchema).default([]),
}).passthrough()

export const stravaStreamSchema = z.object({
  data: z.array(z.number().finite()),
  series_type: z.string(),
  original_size: z.number().int().nonnegative(),
  resolution: z.string(),
}).passthrough()

export const stravaStreamsSchema = z.record(z.string(), stravaStreamSchema)
export const stravaActivitySummariesSchema = z.array(stravaActivitySummarySchema)

export type StravaActivitySummary = z.infer<typeof stravaActivitySummarySchema>
export type StravaActivityDetail = z.infer<typeof stravaActivityDetailSchema>
export type StravaBestEffort = z.infer<typeof stravaBestEffortSchema>
export type StravaStream = z.infer<typeof stravaStreamSchema>
