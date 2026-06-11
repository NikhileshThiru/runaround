import { sameOriginPost, sameOriginPostWithResponse } from './apiClient'

export type StravaStreamKey = 'time' | 'distance' | 'velocity_smooth' | 'heartrate' | 'cadence' | 'watts'

export interface StravaRateLimitHeaders {
  limit?: string
  usage?: string
  readLimit?: string
  readUsage?: string
}

export function fetchAthlete<T>(): Promise<T> {
  return sameOriginPost<T>('/api/strava', { operation: 'athlete' })
}

export function fetchActivitySummaries<T>(options: {
  page?: number
  perPage?: number
  after?: number
  before?: number
} = {}): Promise<T> {
  return sameOriginPost<T>('/api/strava', { operation: 'activities', ...options })
}

export function fetchActivitySummariesWithResponse<T>(options: {
  page?: number
  perPage?: number
  after?: number
  before?: number
} = {}) {
  return sameOriginPostWithResponse<T>('/api/strava', { operation: 'activities', ...options })
}

export function fetchActivityDetail<T>(id: number): Promise<T> {
  return sameOriginPost<T>('/api/strava', { operation: 'activityDetail', id })
}

export function fetchActivityDetailWithResponse<T>(id: number) {
  return sameOriginPostWithResponse<T>('/api/strava', { operation: 'activityDetail', id })
}

export function fetchActivityStreams<T>(id: number, keys: readonly StravaStreamKey[]): Promise<T> {
  return sameOriginPost<T>('/api/strava', { operation: 'activityStreams', id, keys })
}

export function fetchActivityStreamsWithResponse<T>(id: number, keys: readonly StravaStreamKey[]) {
  return sameOriginPostWithResponse<T>('/api/strava', { operation: 'activityStreams', id, keys })
}
