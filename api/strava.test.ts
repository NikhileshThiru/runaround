import { describe, expect, it } from 'vitest'
import { parseOperation } from './strava'

describe('Strava proxy operation allowlist', () => {
  it('allows supported operations with bounded values', () => {
    expect(parseOperation({ operation: 'athlete' })).toEqual({ operation: 'athlete' })
    expect(parseOperation({ operation: 'activities', page: 2, perPage: 200 })).toEqual({
      operation: 'activities', page: 2, perPage: 200, after: undefined, before: undefined,
    })
    expect(parseOperation({ operation: 'activityDetail', id: 123 })).toEqual({
      operation: 'activityDetail', id: 123,
    })
  })

  it('rejects arbitrary URLs, latitude/longitude streams, and invalid IDs', () => {
    expect(parseOperation({ operation: 'fetch', url: 'https://attacker.example' })).toBeNull()
    expect(parseOperation({ operation: 'activityStreams', id: 123, keys: ['latlng'] })).toBeNull()
    expect(parseOperation({ operation: 'activityDetail', id: '../athlete' })).toBeNull()
    expect(parseOperation({ operation: 'activities', perPage: 201 })).toBeNull()
  })

  it('deduplicates supported stream keys', () => {
    expect(parseOperation({
      operation: 'activityStreams', id: 123, keys: ['time', 'heartrate', 'time'],
    })).toEqual({ operation: 'activityStreams', id: 123, keys: ['time', 'heartrate'] })
  })
})
