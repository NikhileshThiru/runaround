import { describe, expect, it } from 'vitest'
import { parseRateLimitHeaders, shouldPauseForRateLimit } from './stravaSync'

describe('Strava rate limit handling', () => {
  it('prefers read-rate headers when present', () => {
    const headers = new Headers({
      'x-ratelimit-limit': '100,1000',
      'x-ratelimit-usage': '10,100',
      'x-readratelimit-limit': '200,2000',
      'x-readratelimit-usage': '20,200',
    })
    expect(parseRateLimitHeaders(headers)).toEqual({
      shortLimit: 200,
      dailyLimit: 2000,
      shortUsage: 20,
      dailyUsage: 200,
    })
  })

  it('pauses before either provider window is exhausted', () => {
    expect(shouldPauseForRateLimit({
      shortLimit: 100, dailyLimit: 1000, shortUsage: 95, dailyUsage: 100,
    })).toBe(true)
    expect(shouldPauseForRateLimit({
      shortLimit: 100, dailyLimit: 1000, shortUsage: 10, dailyUsage: 996,
    })).toBe(true)
    expect(shouldPauseForRateLimit({
      shortLimit: 100, dailyLimit: 1000, shortUsage: 10, dailyUsage: 100,
    })).toBe(false)
  })
})
