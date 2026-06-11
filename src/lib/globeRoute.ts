export type RouteStage = 'united-states' | 'global'

export interface RouteMilestone {
  id: string
  city: string
  region: string
  country: string
  lat: number
  lng: number
  stage: RouteStage
  stateCode?: string
}

export interface RouteMilestoneWithDistance extends RouteMilestone {
  segmentMiles: number
  cumulativeMiles: number
}

export interface GlobePosition {
  lat: number
  lng: number
}

export interface RouteSegmentProgress {
  index: number
  from: RouteMilestoneWithDistance
  to: RouteMilestoneWithDistance
  progress: number
}

export interface JourneyProgress {
  actualLifetimeMiles: number
  appliedRouteMiles: number
  totalRouteMiles: number
  excessMiles: number
  progress: number
  stage: RouteStage
  stageProgress: number
  completed: boolean
  completedMilestones: RouteMilestoneWithDistance[]
  completedStates: string[]
  currentPosition: GlobePosition
  currentSegment: RouteSegmentProgress | null
  nextMilestone: RouteMilestoneWithDistance | null
  milesUntilNext: number
}

const EARTH_RADIUS_MILES = 3958.7613
const ROUTE_VERSION = 2

export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const

// Coordinates are city-center milestones. The route is a virtual narrative;
// segment weights are great-circle distances rather than driving distances.
export const ROUTE_MILESTONES: readonly RouteMilestone[] = [
  us('us-ga-atlanta', 'Atlanta', 'Georgia', 'GA', 33.749, -84.388),
  us('us-fl-tallahassee', 'Tallahassee', 'Florida', 'FL', 30.4383, -84.2807),
  us('us-sc-columbia', 'Columbia', 'South Carolina', 'SC', 34.0007, -81.0348),
  us('us-nc-raleigh', 'Raleigh', 'North Carolina', 'NC', 35.7796, -78.6382),
  us('us-va-richmond', 'Richmond', 'Virginia', 'VA', 37.5407, -77.436),
  // Slightly inland from the State House so the marker remains inside the
  // simplified Natural Earth coastline at every supported zoom level.
  us('us-md-annapolis', 'Annapolis', 'Maryland', 'MD', 38.9784, -76.51),
  us('us-de-dover', 'Dover', 'Delaware', 'DE', 39.1582, -75.5244),
  us('us-pa-harrisburg', 'Harrisburg', 'Pennsylvania', 'PA', 40.2732, -76.8867),
  us('us-nj-trenton', 'Trenton', 'New Jersey', 'NJ', 40.2171, -74.7429),
  us('us-ny-albany', 'Albany', 'New York', 'NY', 42.6526, -73.7562),
  us('us-ct-hartford', 'Hartford', 'Connecticut', 'CT', 41.7658, -72.6734),
  us('us-ri-providence', 'Providence', 'Rhode Island', 'RI', 41.824, -71.4128),
  us('us-ma-boston', 'Boston', 'Massachusetts', 'MA', 42.3601, -71.0589),
  us('us-nh-concord', 'Concord', 'New Hampshire', 'NH', 43.2081, -71.5376),
  us('us-me-augusta', 'Augusta', 'Maine', 'ME', 44.3106, -69.7795),
  us('us-vt-montpelier', 'Montpelier', 'Vermont', 'VT', 44.2601, -72.5754),
  us('us-wv-charleston', 'Charleston', 'West Virginia', 'WV', 38.3498, -81.6326),
  us('us-oh-columbus', 'Columbus', 'Ohio', 'OH', 39.9612, -82.9988),
  us('us-mi-lansing', 'Lansing', 'Michigan', 'MI', 42.7325, -84.5555),
  us('us-in-indianapolis', 'Indianapolis', 'Indiana', 'IN', 39.7684, -86.1581),
  us('us-ky-frankfort', 'Frankfort', 'Kentucky', 'KY', 38.2009, -84.8777),
  us('us-tn-nashville', 'Nashville', 'Tennessee', 'TN', 36.1627, -86.7816),
  us('us-al-montgomery', 'Montgomery', 'Alabama', 'AL', 32.3668, -86.3),
  us('us-ms-jackson', 'Jackson', 'Mississippi', 'MS', 32.2988, -90.1848),
  us('us-la-baton-rouge', 'Baton Rouge', 'Louisiana', 'LA', 30.4515, -91.1871),
  us('us-ar-little-rock', 'Little Rock', 'Arkansas', 'AR', 34.7465, -92.2896),
  us('us-mo-jefferson-city', 'Jefferson City', 'Missouri', 'MO', 38.5767, -92.1735),
  us('us-il-springfield', 'Springfield', 'Illinois', 'IL', 39.7817, -89.6501),
  us('us-wi-madison', 'Madison', 'Wisconsin', 'WI', 43.0731, -89.4012),
  us('us-mn-saint-paul', 'Saint Paul', 'Minnesota', 'MN', 44.9537, -93.09),
  us('us-ia-des-moines', 'Des Moines', 'Iowa', 'IA', 41.5868, -93.625),
  us('us-ne-lincoln', 'Lincoln', 'Nebraska', 'NE', 40.8136, -96.7026),
  us('us-ks-topeka', 'Topeka', 'Kansas', 'KS', 39.0473, -95.6752),
  us('us-ok-oklahoma-city', 'Oklahoma City', 'Oklahoma', 'OK', 35.4676, -97.5164),
  us('us-tx-austin', 'Austin', 'Texas', 'TX', 30.2672, -97.7431),
  us('us-nm-santa-fe', 'Santa Fe', 'New Mexico', 'NM', 35.687, -105.9378),
  us('us-co-denver', 'Denver', 'Colorado', 'CO', 39.7392, -104.9903),
  us('us-wy-cheyenne', 'Cheyenne', 'Wyoming', 'WY', 41.14, -104.8202),
  us('us-sd-pierre', 'Pierre', 'South Dakota', 'SD', 44.3683, -100.351),
  us('us-nd-bismarck', 'Bismarck', 'North Dakota', 'ND', 46.8083, -100.7837),
  us('us-mt-helena', 'Helena', 'Montana', 'MT', 46.5891, -112.0391),
  us('us-id-boise', 'Boise', 'Idaho', 'ID', 43.615, -116.2023),
  us('us-ut-salt-lake-city', 'Salt Lake City', 'Utah', 'UT', 40.7608, -111.891),
  us('us-az-phoenix', 'Phoenix', 'Arizona', 'AZ', 33.4484, -112.074),
  us('us-nv-carson-city', 'Carson City', 'Nevada', 'NV', 39.1638, -119.7674),
  us('us-ca-sacramento', 'Sacramento', 'California', 'CA', 38.5816, -121.4944),
  us('us-or-salem', 'Salem', 'Oregon', 'OR', 44.9429, -123.0351),
  us('us-wa-olympia', 'Olympia', 'Washington', 'WA', 47.0379, -122.9007),
  us('us-ak-juneau', 'Juneau', 'Alaska', 'AK', 58.295, -134.42),
  us('us-hi-honolulu', 'Honolulu', 'Hawaii', 'HI', 21.3099, -157.8581),
  global('global-jp-tokyo', 'Tokyo', 'Japan', 35.6762, 139.6503),
  global('global-kr-seoul', 'Seoul', 'South Korea', 37.5665, 126.978),
  global('global-cn-shanghai', 'Shanghai', 'China', 31.2304, 121.4737),
  global('global-hk-hong-kong', 'Hong Kong', 'Hong Kong', 22.3193, 114.1694),
  global('global-th-bangkok', 'Bangkok', 'Thailand', 13.7563, 100.5018),
  global('global-sg-singapore', 'Singapore', 'Singapore', 1.3521, 103.8198),
  global('global-in-mumbai', 'Mumbai', 'India', 19.076, 72.8777),
  global('global-ae-dubai', 'Dubai', 'United Arab Emirates', 25.2048, 55.2708),
  global('global-ke-nairobi', 'Nairobi', 'Kenya', -1.2921, 36.8219),
  global('global-za-cape-town', 'Cape Town', 'South Africa', -33.9249, 18.4241),
  global('global-eg-cairo', 'Cairo', 'Egypt', 30.0444, 31.2357),
  global('global-tr-istanbul', 'Istanbul', 'Turkey', 41.0082, 28.9784),
  global('global-gr-athens', 'Athens', 'Greece', 37.9838, 23.7275),
  global('global-it-rome', 'Rome', 'Italy', 41.9028, 12.4964),
  global('global-fr-paris', 'Paris', 'France', 48.8566, 2.3522),
  global('global-gb-london', 'London', 'United Kingdom', 51.5074, -0.1278),
  global('global-is-reykjavik', 'Reykjavik', 'Iceland', 64.1466, -21.9426),
  global('global-us-new-york', 'New York', 'United States', 40.7128, -74.006),
  global('global-us-atlanta-complete', 'Atlanta', 'United States', 33.749, -84.388),
] as const

function us(
  id: string,
  city: string,
  region: string,
  stateCode: string,
  lat: number,
  lng: number,
): RouteMilestone {
  return { id, city, region, country: 'United States', stateCode, lat, lng, stage: 'united-states' }
}

function global(
  id: string,
  city: string,
  country: string,
  lat: number,
  lng: number,
): RouteMilestone {
  return { id, city, region: country, country, lat, lng, stage: 'global' }
}

function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI)
}

function normalizeLongitude(longitude: number): number {
  return ((longitude + 540) % 360) - 180
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

/**
 * Computes the shortest surface distance between two latitude/longitude points.
 * The haversine form is numerically stable for short segments: it derives the
 * central angle first, then scales that angle by Earth's mean radius in miles.
 */
export function haversineMiles(start: GlobePosition, end: GlobePosition): number {
  const startLat = degreesToRadians(start.lat)
  const endLat = degreesToRadians(end.lat)
  const deltaLat = endLat - startLat
  const deltaLng = degreesToRadians(normalizeLongitude(end.lng - start.lng))

  const haversine =
    Math.sin(deltaLat / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))

  return EARTH_RADIUS_MILES * centralAngle
}

type Vector3 = readonly [number, number, number]

function toUnitVector(position: GlobePosition): Vector3 {
  const lat = degreesToRadians(position.lat)
  const lng = degreesToRadians(position.lng)
  const cosLat = Math.cos(lat)
  return [cosLat * Math.cos(lng), cosLat * Math.sin(lng), Math.sin(lat)]
}

function normalizeVector([x, y, z]: Vector3): Vector3 {
  const magnitude = Math.hypot(x, y, z)
  if (magnitude === 0) return [1, 0, 0]
  return [x / magnitude, y / magnitude, z / magnitude]
}

function cross([ax, ay, az]: Vector3, [bx, by, bz]: Vector3): Vector3 {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]
}

function fromUnitVector([x, y, z]: Vector3): GlobePosition {
  return {
    lat: radiansToDegrees(Math.atan2(z, Math.hypot(x, y))),
    lng: normalizeLongitude(radiansToDegrees(Math.atan2(y, x))),
  }
}

/**
 * Interpolates on the sphere rather than linearly blending latitude/longitude.
 * For nearly identical points a normalized vector blend avoids division by a
 * tiny sine. For antipodal points there is no unique shortest arc, so a stable
 * orthogonal great circle is selected deterministically.
 */
export function interpolateGreatCircle(
  start: GlobePosition,
  end: GlobePosition,
  fraction: number,
): GlobePosition {
  const progress = clamp(fraction, 0, 1)
  if (progress === 0) return { lat: start.lat, lng: start.lng }
  if (progress === 1) return { lat: end.lat, lng: end.lng }

  const a = toUnitVector(start)
  const b = toUnitVector(end)
  const dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)

  if (dot > 0.999999) {
    return fromUnitVector(normalizeVector([
      a[0] + progress * (b[0] - a[0]),
      a[1] + progress * (b[1] - a[1]),
      a[2] + progress * (b[2] - a[2]),
    ]))
  }

  if (dot < -0.999999) {
    const reference: Vector3 = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]
    const orthogonal = normalizeVector(cross(a, reference))
    const angle = Math.PI * progress
    return fromUnitVector(normalizeVector([
      Math.cos(angle) * a[0] + Math.sin(angle) * orthogonal[0],
      Math.cos(angle) * a[1] + Math.sin(angle) * orthogonal[1],
      Math.cos(angle) * a[2] + Math.sin(angle) * orthogonal[2],
    ]))
  }

  const angle = Math.acos(dot)
  const sinAngle = Math.sin(angle)
  const startWeight = Math.sin((1 - progress) * angle) / sinAngle
  const endWeight = Math.sin(progress * angle) / sinAngle

  return fromUnitVector(normalizeVector([
    startWeight * a[0] + endWeight * b[0],
    startWeight * a[1] + endWeight * b[1],
    startWeight * a[2] + endWeight * b[2],
  ]))
}

export function validateRoute(milestones: readonly RouteMilestone[] = ROUTE_MILESTONES): void {
  if (milestones.length < 2) throw new Error('Route requires at least two milestones.')
  if (milestones[0]?.id !== 'us-ga-atlanta') throw new Error('Route must start in Atlanta.')
  if (milestones.at(-1)?.id !== 'global-us-atlanta-complete') {
    throw new Error('Route must complete in Atlanta.')
  }

  const ids = new Set<string>()
  const states = new Map<string, number>()
  let reachedGlobalStage = false

  for (const milestone of milestones) {
    if (ids.has(milestone.id)) throw new Error(`Duplicate milestone ID: ${milestone.id}`)
    ids.add(milestone.id)

    if (milestone.lat < -90 || milestone.lat > 90) {
      throw new Error(`Invalid latitude for ${milestone.id}`)
    }
    if (milestone.lng < -180 || milestone.lng > 180) {
      throw new Error(`Invalid longitude for ${milestone.id}`)
    }

    if (milestone.stage === 'global') reachedGlobalStage = true
    if (milestone.stage === 'united-states' && reachedGlobalStage) {
      throw new Error('United States milestones cannot follow the global stage.')
    }

    if (milestone.stateCode) {
      states.set(milestone.stateCode, (states.get(milestone.stateCode) ?? 0) + 1)
    }
  }

  for (const stateCode of US_STATE_CODES) {
    if (states.get(stateCode) !== 1) {
      throw new Error(`State ${stateCode} must appear exactly once.`)
    }
  }
  if (states.size !== US_STATE_CODES.length) throw new Error('Route contains an unknown state code.')
}

export function buildRoute(
  milestones: readonly RouteMilestone[] = ROUTE_MILESTONES,
): RouteMilestoneWithDistance[] {
  validateRoute(milestones)

  let cumulativeMiles = 0
  return milestones.map((milestone, index) => {
    const previous = milestones[index - 1]
    const segmentMiles = previous ? haversineMiles(previous, milestone) : 0
    cumulativeMiles += segmentMiles
    return { ...milestone, segmentMiles, cumulativeMiles }
  })
}

export const ROUTE = buildRoute()
export const ROUTE_METADATA = Object.freeze({ version: ROUTE_VERSION, totalMiles: ROUTE.at(-1)!.cumulativeMiles })

function stageBounds(route: readonly RouteMilestoneWithDistance[], stage: RouteStage) {
  const stageMilestones = route.filter((milestone) => milestone.stage === stage)
  const first = stageMilestones[0]
  const last = stageMilestones.at(-1)
  if (!first || !last) throw new Error(`Missing ${stage} route stage.`)

  const startIndex = route.findIndex((milestone) => milestone.id === first.id)
  const startMiles = startIndex === 0 ? 0 : route[startIndex - 1]!.cumulativeMiles
  return { startMiles, endMiles: last.cumulativeMiles }
}

export function getJourneyProgress(
  lifetimeMiles: number,
  route: readonly RouteMilestoneWithDistance[] = ROUTE,
): JourneyProgress {
  if (!Number.isFinite(lifetimeMiles)) throw new Error('Lifetime miles must be finite.')
  if (route.length < 2) throw new Error('Computed route requires at least two milestones.')

  const actualLifetimeMiles = Math.max(0, lifetimeMiles)
  const totalRouteMiles = route.at(-1)!.cumulativeMiles
  const appliedRouteMiles = Math.min(actualLifetimeMiles, totalRouteMiles)
  const completed = appliedRouteMiles >= totalRouteMiles
  const completedMilestones = route.filter((milestone) => milestone.cumulativeMiles <= appliedRouteMiles)
  const completedStates = completedMilestones.flatMap((milestone) => milestone.stateCode ?? [])

  if (completed) {
    const finalMilestone = route.at(-1)!
    return {
      actualLifetimeMiles,
      appliedRouteMiles,
      totalRouteMiles,
      excessMiles: actualLifetimeMiles - totalRouteMiles,
      progress: 1,
      stage: 'global',
      stageProgress: 1,
      completed: true,
      completedMilestones,
      completedStates,
      currentPosition: { lat: finalMilestone.lat, lng: finalMilestone.lng },
      currentSegment: null,
      nextMilestone: null,
      milesUntilNext: 0,
    }
  }

  const nextIndex = route.findIndex((milestone) => milestone.cumulativeMiles > appliedRouteMiles)
  const to = route[nextIndex]!
  const from = route[nextIndex - 1]!
  const segmentProgress = to.segmentMiles === 0
    ? 1
    : (appliedRouteMiles - from.cumulativeMiles) / to.segmentMiles
  const stage = to.stage
  const bounds = stageBounds(route, stage)
  const stageProgress = clamp(
    (appliedRouteMiles - bounds.startMiles) / (bounds.endMiles - bounds.startMiles),
    0,
    1,
  )

  return {
    actualLifetimeMiles,
    appliedRouteMiles,
    totalRouteMiles,
    excessMiles: 0,
    progress: totalRouteMiles === 0 ? 1 : appliedRouteMiles / totalRouteMiles,
    stage,
    stageProgress,
    completed: false,
    completedMilestones,
    completedStates,
    currentPosition: interpolateGreatCircle(from, to, segmentProgress),
    currentSegment: { index: nextIndex - 1, from, to, progress: segmentProgress },
    nextMilestone: to,
    milesUntilNext: to.cumulativeMiles - appliedRouteMiles,
  }
}
