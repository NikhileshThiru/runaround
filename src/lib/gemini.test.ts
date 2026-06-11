import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StravaActivitySummary } from '@/schemas/strava'
import { computeAthleteProfile } from './athleteProfile'

const { sameOriginPost } = vi.hoisted(() => ({ sameOriginPost: vi.fn() }))

vi.mock('./apiClient', () => ({ sameOriginPost }))

import { getCoachingRecommendation } from './gemini'

const recommendation = {
  sessionType: 'Easy aerobic run',
  distanceOrDuration: '3 miles',
  targetEffort: 'Conversational',
  focus: 'Controlled effort',
  reason: 'Current workload supports an easy session.',
  intensity: 'easy' as const,
}

function activity(id: number, startDate: string): StravaActivitySummary {
  return {
    id,
    name: 'Run',
    type: 'Run',
    sport_type: 'Run',
    distance: 5000,
    moving_time: 1800,
    elapsed_time: 1800,
    total_elevation_gain: 0,
    start_date: startDate,
    start_date_local: startDate,
  }
}

describe('Gemini coaching cache', () => {
  beforeEach(() => {
    localStorage.clear()
    sameOriginPost.mockReset().mockResolvedValue(recommendation)
  })

  it('calls the proxy at most once per date and reuses the validated record', async () => {
    const recent = [activity(1, '2026-06-08T12:00:00.000Z')]
    const profile = computeAthleteProfile(recent, undefined, new Date('2026-06-09T12:00:00.000Z'))

    await getCoachingRecommendation(profile, recent, { now: new Date('2026-06-09T08:00:00.000Z') })
    const cached = await getCoachingRecommendation(profile, recent, { now: new Date('2026-06-09T18:00:00.000Z') })

    expect(cached).toEqual(recommendation)
    expect(sameOriginPost).toHaveBeenCalledTimes(1)
  })

  it('regenerates only after an explicit request with a newer activity watermark', async () => {
    const initial = [activity(1, '2026-06-08T12:00:00.000Z')]
    const newer = [activity(2, '2026-06-09T14:00:00.000Z'), ...initial]
    const now = new Date('2026-06-09T18:00:00.000Z')
    const profile = computeAthleteProfile(newer, undefined, now)

    await getCoachingRecommendation(profile, initial, { now })
    await getCoachingRecommendation(profile, initial, { now, regenerate: true })
    await getCoachingRecommendation(profile, newer, { now, regenerate: true })

    expect(sameOriginPost).toHaveBeenCalledTimes(2)
  })

  it('allowlists metrics before sending activity history to the AI proxy', async () => {
    const privateActivity = {
      ...activity(1, '2026-06-08T12:00:00.000Z'),
      name: 'Private route name',
      start_latlng: [33.7, -84.4],
      map: { summary_polyline: 'private-map-data' },
      average_cadence: 82,
    }
    const profile = computeAthleteProfile([privateActivity], undefined, new Date('2026-06-09T12:00:00.000Z'))

    await getCoachingRecommendation(profile, [privateActivity], { now: new Date('2026-06-09T12:00:00.000Z') })

    const proxyBody: unknown = sameOriginPost.mock.calls[0]?.[1]
    const serialized = JSON.stringify(proxyBody)
    expect(serialized).not.toContain('Private route name')
    expect(serialized).not.toContain('private-map-data')
    expect(serialized).not.toContain('33.7')
    expect(serialized).toContain('"averageCadence":164')
  })
})
