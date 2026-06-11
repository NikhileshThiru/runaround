/**
 * Generates the deterministic demo snapshot served to public visitors until
 * the owner publishes real data. Every value is synthetic but internally
 * consistent: lifetime mileage places the journey 35 states deep, weekly
 * mileage matches the daily-load EWMA series, and activity summaries match
 * their own distance/pace/heart-rate numbers. No provider API is involved.
 *
 * Usage: npm run snapshot:demo
 */
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { publicSnapshotSchema, type PublicSnapshot } from '../src/schemas/publicSnapshot'
import { getJourneyProgress, ROUTE } from '../src/lib/globeRoute'

const PUBLISHED_AT = new Date('2026-06-08T00:00:00.000Z')
const DEMO_STATE_COUNT = 35

/** Deterministic PRNG so every regeneration produces the identical snapshot. */
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = mulberry32(20260608)

function between(minimum: number, maximum: number): number {
  return minimum + random() * (maximum - minimum)
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function dateKey(daysAgo: number): string {
  return new Date(PUBLISHED_AT.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10)
}

function opaqueId(): string {
  return Array.from({ length: 16 }, () => Math.floor(random() * 16).toString(16)).join('')
}

function formatPace(secondsPerMile: number): string {
  const total = Math.round(secondsPerMile)
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`
}

// --- Journey position --------------------------------------------------------

// Lifetime miles land partway between the 35th and 36th state capitals so the
// globe shows a checkpoint mid-segment rather than parked exactly on a city.
const stateMilestones = ROUTE.filter((milestone) => milestone.stateCode)
const reachedMilestone = stateMilestones[DEMO_STATE_COUNT - 1]!
const nextMilestone = ROUTE[ROUTE.findIndex((m) => m.id === reachedMilestone.id) + 1]!
const lifetimeMovementMiles = round(
  reachedMilestone.cumulativeMiles + nextMilestone.segmentMiles * 0.42,
  1,
)

const journey = getJourneyProgress(lifetimeMovementMiles)
if (journey.completedStates.length !== DEMO_STATE_COUNT) {
  throw new Error(`Expected ${DEMO_STATE_COUNT} states, got ${journey.completedStates.length}.`)
}

// --- Trends -------------------------------------------------------------------

// Twelve completed Monday-Sunday weeks around a ~31 mi/wk base with one
// recovery dip, newest last. PUBLISHED_AT (2026-06-08) is a Monday.
const weeklyMiles = [27.4, 30.8, 33.1, 29.6, 34.9, 24.2, 31.7, 35.4, 32.8, 36.6, 30.2, 33.9]
const weeklyMileage = weeklyMiles.map((miles, index) => ({
  weekStart: dateKey((weeklyMiles.length - index) * 7),
  miles,
  baseline: 32.35,
}))

// 84 days of CTL/ATL/form via the same EWMA the app uses, fed by a 7-day
// pattern (long Sunday, hard Tuesday/Friday, rest Monday) with light noise.
const weekdayLoadPattern = [0, 52, 70, 48, 0, 66, 88]
const load: PublicSnapshot['trends']['load'] = []
let ctl = 41
let atl = 41
for (let daysAgo = 83; daysAgo >= 0; daysAgo -= 1) {
  const date = new Date(PUBLISHED_AT.getTime() - daysAgo * 86_400_000)
  const base = weekdayLoadPattern[date.getUTCDay()]!
  const dayLoad = base === 0 ? 0 : Math.max(0, base + between(-12, 12))
  ctl += (dayLoad - ctl) / 42
  atl += (dayLoad - atl) / 7
  load.push({ date: date.toISOString().slice(0, 10), ctl: round(ctl), atl: round(atl), form: round(ctl - atl) })
}

// Thirty days of run observations on non-rest days: pace drifts faster as the
// block progresses, heart rate follows effort, cadence creeps upward.
const running: PublicSnapshot['trends']['running'] = []
for (let daysAgo = 29; daysAgo >= 0; daysAgo -= 1) {
  const date = new Date(PUBLISHED_AT.getTime() - daysAgo * 86_400_000)
  const base = weekdayLoadPattern[date.getUTCDay()]!
  if (base === 0) continue
  const hardDay = base > 60
  const pace = (hardDay ? 462 : 532) + between(-14, 14) - (29 - daysAgo) * 0.5
  running.push({
    date: date.toISOString().slice(0, 10),
    paceSecondsPerMile: round(pace),
    averageHeartRate: round(hardDay ? between(158, 166) : between(139, 147)),
    cadence: round(between(170, 175), 1),
  })
}

// --- Recent activities ----------------------------------------------------------

interface DemoActivitySpec {
  daysAgo: number
  sport: 'Run' | 'TrailRun' | 'GravelRide' | 'Pickleball'
  miles?: number
  paceSecondsPerMile?: number
  durationSeconds?: number
  heartRate: number
  cadence: number | null
  intensity: 'easy' | 'moderate' | 'hard'
  withCharts?: boolean
}

const OBSERVED_MAX_HR = 192

const activitySpecs: DemoActivitySpec[] = [
  { daysAgo: 0, sport: 'Run', miles: 12.2, paceSecondsPerMile: 545, heartRate: 146, cadence: 172, intensity: 'easy', withCharts: true },
  { daysAgo: 2, sport: 'Run', miles: 6.1, paceSecondsPerMile: 452, heartRate: 169, cadence: 176, intensity: 'hard', withCharts: true },
  { daysAgo: 3, sport: 'TrailRun', miles: 4.8, paceSecondsPerMile: 612, heartRate: 149, cadence: 166, intensity: 'easy' },
  { daysAgo: 4, sport: 'Pickleball', durationSeconds: 4_980, heartRate: 132, cadence: null, intensity: 'easy' },
  { daysAgo: 5, sport: 'Run', miles: 7.3, paceSecondsPerMile: 489, heartRate: 158, cadence: 174, intensity: 'moderate', withCharts: true },
  { daysAgo: 7, sport: 'Run', miles: 14.1, paceSecondsPerMile: 551, heartRate: 148, cadence: 171, intensity: 'easy' },
  { daysAgo: 9, sport: 'Run', miles: 5.5, paceSecondsPerMile: 448, heartRate: 171, cadence: 177, intensity: 'hard' },
  { daysAgo: 10, sport: 'GravelRide', miles: 22.4, durationSeconds: 4_690, heartRate: 136, cadence: 88, intensity: 'easy' },
  { daysAgo: 11, sport: 'Run', miles: 5.0, paceSecondsPerMile: 561, heartRate: 140, cadence: 169, intensity: 'easy' },
  { daysAgo: 12, sport: 'Run', miles: 8.2, paceSecondsPerMile: 497, heartRate: 156, cadence: 173, intensity: 'moderate' },
  { daysAgo: 14, sport: 'Run', miles: 13.4, paceSecondsPerMile: 549, heartRate: 147, cadence: 171, intensity: 'easy' },
  { daysAgo: 16, sport: 'Run', miles: 6.0, paceSecondsPerMile: 455, heartRate: 168, cadence: 176, intensity: 'hard' },
]

function chartSeries(
  samples: number,
  center: number,
  jitter: number,
  drift: number,
): { index: number; value: number }[] {
  return Array.from({ length: samples }, (_, index) => ({
    index,
    value: round(center + between(-jitter, jitter) + Math.sin(index / 9) * jitter * 0.7 + (index / samples) * drift),
  }))
}

const recentActivities: PublicSnapshot['recentActivities'] = activitySpecs.map((spec) => {
  const isRunType = spec.sport.toLowerCase().includes('run')
  const sportLabel = spec.sport.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  const durationSeconds = spec.durationSeconds
    ?? Math.round(spec.miles! * spec.paceSecondsPerMile!)
  const summary = isRunType
    ? `${spec.miles!.toFixed(1)} mile run at ${formatPace(spec.paceSecondsPerMile!)} per mile.`
    : spec.miles
      ? `${spec.miles.toFixed(1)} miles of ${sportLabel} in ${Math.round(durationSeconds / 60)} minutes.`
      : `${Math.round(durationSeconds / 60)} minutes of ${sportLabel}.`
  return {
    id: opaqueId(),
    date: dateKey(spec.daysAgo),
    sportType: spec.sport,
    distanceMiles: spec.miles ?? null,
    durationSeconds,
    averagePaceSecondsPerMile: isRunType ? spec.paceSecondsPerMile! : null,
    averageHeartRate: spec.heartRate,
    averageCadence: spec.cadence,
    intensity: spec.intensity,
    intensityBasis: `${spec.heartRate} bpm is ${Math.round((spec.heartRate / OBSERVED_MAX_HR) * 100)}% of the observed ${OBSERVED_MAX_HR} bpm maximum.`,
    summary,
    charts: spec.withCharts
      ? {
          pace: chartSeries(150, spec.paceSecondsPerMile!, 16, spec.intensity === 'easy' ? 6 : -10),
          heartRate: chartSeries(150, spec.heartRate, 4, 8),
          cadence: chartSeries(150, spec.cadence!, 2, 1),
        }
      : undefined,
  }
})

// --- Assemble -------------------------------------------------------------------

const snapshot: PublicSnapshot = {
  version: 1,
  publishedAt: PUBLISHED_AT.toISOString(),
  stats: {
    lifetimeMovementMiles,
    lifetimeHours: 1184,
    runCount: 1042,
    longestRunMiles: 18.6,
    personalBests: {
      mile: { elapsedSeconds: 348, distanceMeters: 1609.344 },
      fiveK: { elapsedSeconds: 1262, distanceMeters: 5000 },
      tenK: { elapsedSeconds: 2655, distanceMeters: 10000 },
      halfMarathon: { elapsedSeconds: 5963, distanceMeters: 21097.5 },
      marathon: { elapsedSeconds: 13289, distanceMeters: 42195 },
    },
  },
  coaching: {
    sessionType: 'Easy aerobic run',
    distanceOrDuration: 'Up to 6.4 miles',
    targetEffort: 'Conversational effort',
    focus: 'Absorb yesterday’s long run and keep this week inside the mileage ceiling.',
    reason: 'Form is mildly negative after the weekend long run, and the weekly cap leaves about six miles of headroom.',
    intensity: 'easy',
  },
  trends: { weeklyMileage, load, running },
  recentActivities,
}

const validated = publicSnapshotSchema.parse(snapshot)
const destination = resolve('public/data/snapshot.json')
await writeFile(destination, `${JSON.stringify(validated, null, 2)}\n`)
console.log(`Wrote demo snapshot (${journey.completedStates.length} states, ${lifetimeMovementMiles} mi) to ${destination}`)
