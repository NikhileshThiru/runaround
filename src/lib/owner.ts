import { apiRequest, sameOriginPost } from './apiClient'
import { deleteRunAroundDb } from '@/db/runaroundDb'
import { clearCoachingRecommendationCache } from './gemini'
import { z } from 'zod'

export interface OwnerSessionStatus {
  authenticated: boolean
}

const ownerSessionStatusSchema = z.object({ authenticated: z.boolean() })

export async function getOwnerSession(): Promise<OwnerSessionStatus> {
  const result = await apiRequest<unknown>('/api/owner-session')
  const parsed = ownerSessionStatusSchema.safeParse(result)
  return parsed.success ? parsed.data : { authenticated: false }
}

export async function ownerLogin(password: string): Promise<OwnerSessionStatus> {
  return ownerSessionStatusSchema.parse(await sameOriginPost<unknown>('/api/owner-login', { password }))
}

export async function ownerLogout(): Promise<void> {
  await sameOriginPost<OwnerSessionStatus>('/api/owner-logout', {})
}

export async function disconnectAndDeleteLocalData(): Promise<void> {
  await sameOriginPost('/api/strava', { operation: 'deauthorize' })
  await resetLocalPrivateData()
  await ownerLogout()
}

export async function resetLocalPrivateData(): Promise<void> {
  await deleteRunAroundDb()
  clearCoachingRecommendationCache()
}
