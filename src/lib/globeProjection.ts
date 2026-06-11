import { interpolateGreatCircle, type GlobePosition } from './globeRoute'

/** Radius of the rendered globe in scene units. */
export const GLOBE_RADIUS = 100

export interface SceneVector {
  x: number
  y: number
  z: number
}

/**
 * Projects latitude/longitude onto a sphere of the given radius using the
 * same axis convention as globe.gl: +Y through the north pole, latitude 0 /
 * longitude 0 on the +Z side. Keeping one convention everywhere means
 * boundaries, route lines, and markers always align.
 */
export function latLngToVector(position: GlobePosition, radius = GLOBE_RADIUS): SceneVector {
  const phi = (90 - position.lat) * (Math.PI / 180)
  const theta = (position.lng + 180) * (Math.PI / 180)
  const sinPhi = Math.sin(phi)
  return {
    x: -radius * sinPhi * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * sinPhi * Math.sin(theta),
  }
}

/**
 * Samples a great-circle arc between two milestones. Sample density scales
 * with the covered fraction so short partial segments stay cheap while long
 * ocean crossings remain visually smooth on the sphere.
 */
export function sampleGreatCircleArc(
  start: GlobePosition,
  end: GlobePosition,
  startFraction = 0,
  endFraction = 1,
  samplesPerArc = 32,
): GlobePosition[] {
  const span = Math.max(endFraction - startFraction, 0)
  const sampleCount = Math.max(2, Math.ceil(span * samplesPerArc))

  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const fraction = startFraction + span * (index / sampleCount)
    return interpolateGreatCircle(start, end, fraction)
  })
}
