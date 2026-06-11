import { z } from 'zod'
import { apiRequest, sameOriginPost } from './apiClient'

const kudosResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  counted: z.boolean().optional(),
})

export type KudosResponse = z.infer<typeof kudosResponseSchema>

const GIVEN_STORAGE_KEY = 'runaround_kudos_given'

export async function fetchKudosCount(): Promise<KudosResponse> {
  return kudosResponseSchema.parse(await apiRequest<unknown>('/api/kudos'))
}

export async function giveKudos(): Promise<KudosResponse> {
  return kudosResponseSchema.parse(await sameOriginPost<unknown>('/api/kudos', {}))
}

/** Local mirror of the server's per-visitor dedupe so the UI stays honest. */
export function hasGivenKudos(): boolean {
  try {
    return localStorage.getItem(GIVEN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberKudosGiven(): void {
  try {
    localStorage.setItem(GIVEN_STORAGE_KEY, '1')
  } catch {
    // Storage unavailable (private mode); the server dedupe still applies.
  }
}
