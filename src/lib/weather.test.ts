import { describe, expect, it } from 'vitest'
import { runningConditions, weatherCondition } from './weather'

const base = {
  temperature_2m: 70,
  apparent_temperature: 70,
  relative_humidity_2m: 45,
  precipitation_probability: 0,
  weather_code: 0,
  uv_index: 4,
  wind_speed_10m: 5,
}

describe('running weather verdicts', () => {
  it('uses safety-first precedence', () => {
    expect(runningConditions({ ...base, precipitation_probability: 80, apparent_temperature: 95 }).verdict)
      .toMatch(/rain likely/i)
    expect(runningConditions({ ...base, apparent_temperature: 90, relative_humidity_2m: 70 }).verdict)
      .toMatch(/hot and humid/i)
    expect(runningConditions({ ...base, wind_speed_10m: 25 }).verdict).toMatch(/strong wind/i)
  })

  it('returns good conditions when no caution rule applies', () => {
    expect(runningConditions(base)).toEqual({ level: 'good', verdict: 'Good conditions for a run.' })
  })

  it('maps provider weather codes to concise labels', () => {
    expect(weatherCondition(0)).toBe('Clear')
    expect(weatherCondition(63)).toBe('Rain')
    expect(weatherCondition(95)).toBe('Storms')
  })
})
