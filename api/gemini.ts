import { z } from 'zod'
import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { readJsonBody, requireSameOrigin, sendError } from './_lib/http.js'
import { isOwnerRequest } from './_lib/security.js'
import {
  activityAssessmentInputSchema,
  activityDescriptionSchema,
  coachingActivityInputSchema,
  coachingRecommendationSchema,
} from '../src/schemas/ai.js'
import { athleteProfileSchema } from '../src/schemas/athleteProfile.js'
import type { AthleteProfile } from '../src/schemas/athleteProfile.js'
import {
  coachingConstraints,
  deterministicSafeRecommendation,
  validateRecommendationSafety,
} from '../src/lib/coachingSafety.js'

const recommendationRequestSchema = z.object({
  operation: z.literal('coachingRecommendation'),
  profile: athleteProfileSchema,
  recentActivities: z.array(coachingActivityInputSchema).max(100),
})

const descriptionRequestSchema = z.object({
  operation: z.literal('activityDescription'),
  profile: athleteProfileSchema,
  activity: activityAssessmentInputSchema,
})

const requestSchema = z.discriminatedUnion('operation', [recommendationRequestSchema, descriptionRequestSchema])

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
}

const RECOMMENDATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    sessionType: { type: 'string' },
    distanceOrDuration: { type: 'string' },
    targetEffort: { type: 'string' },
    focus: { type: 'string' },
    reason: { type: 'string' },
    intensity: { type: 'string', enum: ['rest', 'easy', 'moderate', 'hard'] },
  },
  required: ['sessionType', 'distanceOrDuration', 'targetEffort', 'focus', 'reason', 'intensity'],
  additionalProperties: false,
}

const DESCRIPTION_JSON_SCHEMA = {
  type: 'object',
  properties: { assessment: { type: 'string' } },
  required: ['assessment'],
  additionalProperties: false,
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function profileForPrompt(profile: AthleteProfile) {
  return {
    ...profile,
    personalBests: Object.fromEntries(Object.entries(profile.personalBests).map(([distance, best]) => [
      distance,
      best ? {
        elapsedSeconds: best.elapsedSeconds,
        distanceMeters: best.distanceMeters,
        effortName: best.effortName,
      } : null,
    ])),
  }
}

async function callGemini(prompt: string, schema: object, retry = true): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini is not configured.')
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
        },
      }),
    },
  )
  if (response.status === 429 && retry) {
    await sleep(10_000)
    return callGemini(prompt, schema, false)
  }
  if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}.`)
  const payload = await response.json() as GeminiResponse
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no structured content.')
  return JSON.parse(text) as unknown
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== 'POST') return sendError(response, 405, 'Method not allowed.')
  if (!requireSameOrigin(request)) return sendError(response, 403, 'Invalid request origin.')
  if (!isOwnerRequest(request)) return sendError(response, 401, 'Owner authentication required.')

  let parsed: z.infer<typeof requestSchema>
  try {
    parsed = requestSchema.parse(readJsonBody(request))
  } catch {
    return sendError(response, 400, 'Invalid Gemini request.')
  }

  try {
    if (parsed.operation === 'coachingRecommendation') {
      const constraints = coachingConstraints(parsed.profile)
      const promptProfile = profileForPrompt(parsed.profile)
      if (constraints.forceRest) {
        response.status(200).json(deterministicSafeRecommendation(parsed.profile))
        return
      }
      const prompt = [
        'You are an adaptive running coach. Use only the supplied observed data.',
        'Do not invent a race, target, injury, diagnosis, or missing athlete fact.',
        `Hard sessions allowed: ${constraints.hardSessionAllowed}.`,
        `Maximum safe distance miles: ${constraints.maximumSafeDistanceMiles ?? 'unknown; remain conservative'}.`,
        `Athlete profile: ${JSON.stringify(promptProfile)}`,
        `Recent activities: ${JSON.stringify(parsed.recentActivities)}`,
        'Return a concise session within the supplied deterministic constraints.',
      ].join('\n')
      try {
        const generated = coachingRecommendationSchema.parse(
          await callGemini(prompt, RECOMMENDATION_JSON_SCHEMA),
        )
        response.status(200).json(validateRecommendationSafety(generated, parsed.profile))
      } catch {
        response.status(200).json(deterministicSafeRecommendation(parsed.profile))
      }
      return
    }

    const promptProfile = profileForPrompt(parsed.profile)
    const prompt = [
      'Write a direct, data-driven post-workout assessment in 2-3 sentences and under 80 words.',
      'Use only observed values. Do not invent goals, injuries, diagnoses, or missing metrics.',
      `Current athlete profile: ${JSON.stringify(promptProfile)}`,
      `Activity: ${JSON.stringify(parsed.activity)}`,
      'Discuss measured effort, pacing consistency, cadence versus personal baseline, recovery impact, and one actionable note when supported.',
    ].join('\n')
    const generated = activityDescriptionSchema.parse(
      await callGemini(prompt, DESCRIPTION_JSON_SCHEMA),
    )
    response.status(200).json(generated)
  } catch (error) {
    const message = error instanceof Error && error.message === 'Gemini is not configured.'
      ? error.message
      : 'Gemini is temporarily unavailable.'
    sendError(response, message.includes('not configured') ? 503 : 502, message)
  }
}
