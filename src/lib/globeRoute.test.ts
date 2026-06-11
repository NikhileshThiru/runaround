import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ROUTE,
  ROUTE_METADATA,
  ROUTE_MILESTONES,
  US_STATE_CODES,
  buildRoute,
  getJourneyProgress,
  haversineMiles,
  interpolateGreatCircle,
  validateRoute,
} from './globeRoute'

interface StateGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

interface StateFeatureCollection {
  features: Array<{
    properties: { postal?: string }
    geometry: StateGeometry
  }>
}

const stateBoundaries = JSON.parse(readFileSync(
  resolve(process.cwd(), 'public/data/us-states-50m.geojson'),
  'utf8',
)) as StateFeatureCollection
const publicSnapshot = JSON.parse(readFileSync(
  resolve(process.cwd(), 'public/data/snapshot.json'),
  'utf8',
)) as { stats?: { lifetimeMovementMiles?: number } }

describe('route manifest', () => {
  it('contains every state exactly once and valid stage ordering', () => {
    expect(() => validateRoute()).not.toThrow()
    const states = ROUTE_MILESTONES.flatMap((milestone) => milestone.stateCode ?? [])
    expect(states).toHaveLength(50)
    expect(new Set(states)).toEqual(new Set(US_STATE_CODES))
  })

  it('starts and completes in Atlanta', () => {
    expect(ROUTE[0]).toMatchObject({ city: 'Atlanta', stateCode: 'GA', cumulativeMiles: 0 })
    expect(ROUTE.at(-1)).toMatchObject({ city: 'Atlanta', stage: 'global' })
    expect(ROUTE_METADATA.totalMiles).toBeGreaterThan(30_000)
  })

  it('rejects duplicate milestone IDs', () => {
    const invalid = [...ROUTE_MILESTONES]
    invalid[1] = { ...invalid[1]!, id: invalid[0]!.id }
    expect(() => validateRoute(invalid)).toThrow(/duplicate milestone/i)
  })

  it('builds monotonically increasing cumulative distances', () => {
    const built = buildRoute()
    for (let index = 1; index < built.length; index += 1) {
      expect(built[index]!.cumulativeMiles).toBeGreaterThan(built[index - 1]!.cumulativeMiles)
    }
  })

  it('places every capital checkpoint inside its matching state boundary', () => {
    for (const milestone of ROUTE_MILESTONES.filter((item) => item.stateCode)) {
      const state = stateBoundaries.features.find((feature) => feature.properties.postal === milestone.stateCode)
      expect(state, `Missing boundary geometry for ${milestone.stateCode}`).toBeDefined()
      expect(
        geometryContainsPoint(state!.geometry, [milestone.lng, milestone.lat]),
        `${milestone.city} is outside ${milestone.stateCode}`,
      ).toBe(true)
    }
  })
})

function geometryContainsPoint(geometry: StateGeometry, point: [number, number]): boolean {
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates as number[][][]]
    : geometry.coordinates as number[][][][]
  return polygons.some((polygon) => {
    const [outer, ...holes] = polygon
    return Boolean(outer && ringContainsPoint(outer, point) && !holes.some((hole) => ringContainsPoint(hole, point)))
  })
}

function ringContainsPoint(ring: number[][], [x, y]: [number, number]): boolean {
  let inside = false
  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const current = ring[index]
    const previous = ring[previousIndex]
    if (!current || !previous) continue
    const [currentX, currentY] = current
    const [previousX, previousY] = previous
    if (currentX === undefined || currentY === undefined || previousX === undefined || previousY === undefined) continue
    const crosses = (currentY > y) !== (previousY > y)
      && x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX
    if (crosses) inside = !inside
  }
  return inside
}

describe('haversineMiles', () => {
  it('matches the approximate Atlanta to Tallahassee great-circle distance', () => {
    const miles = haversineMiles(
      { lat: 33.749, lng: -84.388 },
      { lat: 30.4383, lng: -84.2807 },
    )
    expect(miles).toBeGreaterThan(225)
    expect(miles).toBeLessThan(235)
  })

  it('returns zero for the same point', () => {
    expect(haversineMiles({ lat: 10, lng: 20 }, { lat: 10, lng: 20 })).toBe(0)
  })
})

describe('interpolateGreatCircle', () => {
  it('takes the short path across the international date line', () => {
    const midpoint = interpolateGreatCircle({ lat: 20, lng: 170 }, { lat: 20, lng: -170 }, 0.5)
    expect(Math.abs(midpoint.lng)).toBeGreaterThan(179)
    expect(midpoint.lat).toBeGreaterThan(20)
  })

  it('returns finite coordinates for antipodal points', () => {
    const midpoint = interpolateGreatCircle({ lat: 0, lng: 0 }, { lat: 0, lng: 180 }, 0.5)
    expect(Number.isFinite(midpoint.lat)).toBe(true)
    expect(Number.isFinite(midpoint.lng)).toBe(true)
  })
})

describe('getJourneyProgress', () => {
  it('keeps the demo snapshot mileage aligned to the 35th state checkpoint', () => {
    expect(publicSnapshot.stats?.lifetimeMovementMiles).toBeTypeOf('number')
    const progress = getJourneyProgress(publicSnapshot.stats!.lifetimeMovementMiles!)
    expect(progress.completedStates).toHaveLength(35)
    expect(progress.currentSegment?.from.id).toBe('us-tx-austin')
    expect(progress.nextMilestone?.id).toBe('us-nm-santa-fe')
  })

  it('starts at Atlanta and points to Tallahassee', () => {
    const progress = getJourneyProgress(0)
    expect(progress.currentPosition).toEqual({ lat: 33.749, lng: -84.388 })
    expect(progress.nextMilestone?.city).toBe('Tallahassee')
    expect(progress.completedStates).toEqual(['GA'])
  })

  it('moves to the next segment at an exact milestone boundary', () => {
    const tallahassee = ROUTE.find((milestone) => milestone.id === 'us-fl-tallahassee')!
    const progress = getJourneyProgress(tallahassee.cumulativeMiles)
    expect(progress.completedStates).toEqual(['GA', 'FL'])
    expect(progress.currentSegment?.from.id).toBe(tallahassee.id)
    expect(progress.nextMilestone?.id).toBe('us-sc-columbia')
  })

  it('transitions to the global stage after Hawaii', () => {
    const hawaii = ROUTE.find((milestone) => milestone.id === 'us-hi-honolulu')!
    const progress = getJourneyProgress(hawaii.cumulativeMiles + 1)
    expect(progress.stage).toBe('global')
    expect(progress.nextMilestone?.city).toBe('Tokyo')
    expect(progress.completedStates).toHaveLength(50)
  })

  it('clamps at completion and preserves excess mileage', () => {
    const progress = getJourneyProgress(ROUTE_METADATA.totalMiles + 500)
    expect(progress.completed).toBe(true)
    expect(progress.progress).toBe(1)
    expect(progress.excessMiles).toBeCloseTo(500)
    expect(progress.nextMilestone).toBeNull()
    expect(progress.currentPosition).toEqual({ lat: 33.749, lng: -84.388 })
  })

  it('treats negative mileage as zero and rejects non-finite mileage', () => {
    expect(getJourneyProgress(-10).appliedRouteMiles).toBe(0)
    expect(() => getJourneyProgress(Number.NaN)).toThrow(/finite/i)
  })
})
