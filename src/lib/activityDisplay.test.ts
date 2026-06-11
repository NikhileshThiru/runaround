import { describe, expect, it } from 'vitest'
import { formatPace, formatSportName, sportAccentColor } from './activityDisplay'

describe('formatSportName', () => {
  it('splits camel-cased Strava sport types into words', () => {
    expect(formatSportName('TrailRun')).toBe('Trail Run')
    expect(formatSportName('GravelRide')).toBe('Gravel Ride')
    expect(formatSportName('HighIntensityIntervalTraining')).toBe('High Intensity Interval Training')
    expect(formatSportName('StandUpPaddling')).toBe('Stand Up Paddling')
  })

  it('hyphenates the electric-bike prefix', () => {
    expect(formatSportName('EBikeRide')).toBe('E-Bike Ride')
    expect(formatSportName('EMountainBikeRide')).toBe('E-Mountain Bike Ride')
  })

  it('passes single-word types through unchanged', () => {
    expect(formatSportName('Run')).toBe('Run')
    expect(formatSportName('Pickleball')).toBe('Pickleball')
    expect(formatSportName('Elliptical')).toBe('Elliptical')
  })
})

describe('sportAccentColor', () => {
  it('groups every category onto its accent and variants agree', () => {
    expect(sportAccentColor('TrailRun')).toBe(sportAccentColor('VirtualRun'))
    expect(sportAccentColor('GravelRide')).toBe(sportAccentColor('EBikeRide'))
    expect(sportAccentColor('Pickleball')).toBe(sportAccentColor('TableTennis'))
    expect(sportAccentColor('Swim')).toBe(sportAccentColor('Kayaking'))
    expect(sportAccentColor('NordicSki')).toBe(sportAccentColor('Snowboard'))
    expect(sportAccentColor('WeightTraining')).toBe(sportAccentColor('Yoga'))
    expect(sportAccentColor('Hike')).toBe(sportAccentColor('Walk'))
  })

  it('returns the neutral accent for unknown types', () => {
    expect(sportAccentColor('Wheelchair')).toBe('#8a94a0')
  })

  it('keeps categories visually distinct', () => {
    const colors = ['Run', 'Ride', 'Tennis', 'Swim', 'NordicSki', 'Yoga', 'Hike']
      .map(sportAccentColor)
    expect(new Set(colors).size).toBe(colors.length)
  })
})

describe('formatPace', () => {
  it('rounds 60-second remainders up to the next minute', () => {
    expect(formatPace(539.7)).toBe('9:00/mi')
  })

  it('returns a dash for missing pace', () => {
    expect(formatPace(null)).toBe('—')
  })
})
