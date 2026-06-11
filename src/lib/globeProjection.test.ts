import { describe, expect, it } from 'vitest'
import { GLOBE_RADIUS, latLngToVector, sampleGreatCircleArc } from './globeProjection'

describe('latLngToVector', () => {
  it('places the north pole on the +Y axis', () => {
    const vector = latLngToVector({ lat: 90, lng: 0 })
    expect(vector.x).toBeCloseTo(0)
    expect(vector.y).toBeCloseTo(GLOBE_RADIUS)
    expect(vector.z).toBeCloseTo(0)
  })

  it('keeps every projected point on the sphere surface', () => {
    const samples = [
      { lat: 33.749, lng: -84.388 },
      { lat: -33.9249, lng: 18.4241 },
      { lat: 64.1466, lng: -21.9426 },
      { lat: 0, lng: 180 },
    ]
    for (const sample of samples) {
      const { x, y, z } = latLngToVector(sample)
      expect(Math.hypot(x, y, z)).toBeCloseTo(GLOBE_RADIUS)
    }
  })

  it('separates antipodal points by a full diameter', () => {
    const a = latLngToVector({ lat: 0, lng: 0 })
    const b = latLngToVector({ lat: 0, lng: 180 })
    const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
    expect(distance).toBeCloseTo(2 * GLOBE_RADIUS)
  })
})

describe('sampleGreatCircleArc', () => {
  const atlanta = { lat: 33.749, lng: -84.388 }
  const tallahassee = { lat: 30.4383, lng: -84.2807 }

  it('starts and ends exactly at the requested fractions', () => {
    const points = sampleGreatCircleArc(atlanta, tallahassee)
    expect(points[0]).toEqual(atlanta)
    expect(points.at(-1)).toEqual(tallahassee)
  })

  it('uses fewer samples for a short partial segment', () => {
    const full = sampleGreatCircleArc(atlanta, tallahassee, 0, 1)
    const partial = sampleGreatCircleArc(atlanta, tallahassee, 0, 0.1)
    expect(partial.length).toBeLessThan(full.length)
    expect(partial.length).toBeGreaterThanOrEqual(3)
  })

  it('returns a degenerate two-point arc for an empty span', () => {
    const points = sampleGreatCircleArc(atlanta, tallahassee, 0.5, 0.5)
    expect(points).toHaveLength(3)
    for (const point of points) {
      expect(point.lat).toBeCloseTo(points[0]!.lat)
      expect(point.lng).toBeCloseTo(points[0]!.lng)
    }
  })
})
