import { z } from 'zod'

const nullableRateValue = z.number().int().nonnegative().nullable()

export const rateLimitWindowSchema = z.object({
  shortLimit: nullableRateValue,
  dailyLimit: nullableRateValue,
  shortUsage: nullableRateValue,
  dailyUsage: nullableRateValue,
})

export const syncResumeSchema = z.object({
  page: z.number().int().positive(),
  after: z.number().int().positive().optional(),
}).nullable()
