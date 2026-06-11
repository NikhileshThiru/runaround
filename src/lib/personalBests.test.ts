import { describe, expect, it } from 'vitest'
import type { StravaActivityDetail } from '@/schemas/strava'
import { createPbScanState, extractPersonalBests, mergeActivityIntoPbScan } from './personalBests'

function detail(bestEfforts: StravaActivityDetail['best_efforts']): StravaActivityDetail {
  return {
    id: 42,
    name: 'Test run',
    type: 'Run',
    sport_type: 'Run',
    distance: 22000,
    moving_time: 7200,
    elapsed_time: 7300,
    total_elevation_gain: 100,
    start_date: '2026-06-01T12:00:00Z',
    start_date_local: '2026-06-01T08:00:00Z',
    best_efforts: bestEfforts,
  }
}

describe('exact personal best extraction', () => {
  it('accepts Strava-named efforts with matching distances', () => {
    const bests = extractPersonalBests(detail([
      { name: '1 mile', distance: 1609.3, elapsed_time: 360, moving_time: 360 },
      { name: '5K', distance: 5000, elapsed_time: 1200, moving_time: 1200 },
      { name: 'Half-Marathon', distance: 21097.5, elapsed_time: 6000, moving_time: 6000 },
    ]))
    expect(bests.mile?.elapsedSeconds).toBe(360)
    expect(bests.fiveK?.elapsedSeconds).toBe(1200)
    expect(bests.halfMarathon?.elapsedSeconds).toBe(6000)
  })

  it('rejects name-only and distance-only guesses', () => {
    const bests = extractPersonalBests(detail([
      { name: '5K', distance: 4000, elapsed_time: 900 },
      { name: 'Morning Run', distance: 5000, elapsed_time: 1000 },
    ]))
    expect(bests.fiveK).toBeUndefined()
  })

  it('keeps the fastest effort and does not double-count scanned activities', () => {
    const state = createPbScanState(2, new Date('2026-06-01T00:00:00Z'))
    const first = mergeActivityIntoPbScan(state, detail([
      { name: '10K', distance: 10000, elapsed_time: 3000 },
    ]))
    const duplicate = mergeActivityIntoPbScan(first, detail([
      { name: '10K', distance: 10000, elapsed_time: 2800 },
    ]))
    expect(duplicate).toBe(first)
    expect(first.bests.tenK?.elapsedSeconds).toBe(3000)
    expect(first.status).toBe('scanning')
  })
})
