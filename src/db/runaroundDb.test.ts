import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteRunAroundDb,
  getActivitySummariesNewestFirst,
  getMetadata,
  putActivitySummaries,
  setMetadata,
} from './runaroundDb'

describe('RunAround IndexedDB', () => {
  afterEach(async () => {
    await deleteRunAroundDb()
  })

  it('stores summaries by ID and reads them newest first', async () => {
    await putActivitySummaries([
      {
        id: 1, name: 'Older', type: 'Run', distance: 1000, moving_time: 300,
        elapsed_time: 300, total_elevation_gain: 0,
        start_date: '2026-06-01T12:00:00Z', start_date_local: '2026-06-01T08:00:00Z',
      },
      {
        id: 2, name: 'Newer', type: 'Run', distance: 2000, moving_time: 600,
        elapsed_time: 600, total_elevation_gain: 0,
        start_date: '2026-06-02T12:00:00Z', start_date_local: '2026-06-02T08:00:00Z',
      },
    ])
    expect((await getActivitySummariesNewestFirst()).map((activity) => activity.id)).toEqual([2, 1])
  })

  it('round-trips versioned metadata', async () => {
    await setMetadata('sync', { page: 2 })
    expect(await getMetadata('sync')).toEqual({ page: 2 })
  })
})
