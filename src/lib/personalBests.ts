import type { PersonalBest, PersonalBestDistance, PersonalBests, PbScanState } from '@/schemas/athleteProfile'
import type { StravaActivityDetail, StravaBestEffort } from '@/schemas/strava'

const PB_TARGETS: Record<PersonalBestDistance, { meters: number; names: readonly string[] }> = {
  mile: { meters: 1609.344, names: ['1 mile', 'mile'] },
  fiveK: { meters: 5000, names: ['5k', '5 km'] },
  tenK: { meters: 10000, names: ['10k', '10 km'] },
  halfMarathon: { meters: 21097.5, names: ['half marathon', 'half-marathon'] },
  marathon: { meters: 42195, names: ['marathon'] },
}

export function emptyPersonalBests(): PersonalBests {
  return { mile: null, fiveK: null, tenK: null, halfMarathon: null, marathon: null }
}

export function createPbScanState(totalRunCount: number, now = new Date()): PbScanState {
  return {
    status: totalRunCount === 0 ? 'complete' : 'not_started',
    scannedActivityIds: [],
    totalRunCount,
    bests: emptyPersonalBests(),
    updatedAt: now.toISOString(),
  }
}

function normalizeEffortName(name: string): string {
  return name.trim().toLowerCase().replace(/[_–—-]+/g, ' ').replace(/\s+/g, ' ')
}

function identifyDistance(effort: StravaBestEffort): PersonalBestDistance | null {
  const normalizedName = normalizeEffortName(effort.name)
  for (const [distance, target] of Object.entries(PB_TARGETS) as [PersonalBestDistance, typeof PB_TARGETS[PersonalBestDistance]][]) {
    const nameMatches = target.names.some((name) => normalizeEffortName(name) === normalizedName)
    const distanceMatches = Math.abs(effort.distance - target.meters) / target.meters <= 0.01
    if (nameMatches && distanceMatches) return distance
  }
  return null
}

export function extractPersonalBests(activity: StravaActivityDetail): Partial<PersonalBests> {
  const extracted: Partial<PersonalBests> = {}
  for (const effort of activity.best_efforts) {
    const distance = identifyDistance(effort)
    if (!distance) continue
    const candidate: PersonalBest = {
      elapsedSeconds: effort.elapsed_time,
      distanceMeters: effort.distance,
      activityId: activity.id,
      effortName: effort.name,
    }
    const current = extracted[distance]
    if (!current || candidate.elapsedSeconds < current.elapsedSeconds) extracted[distance] = candidate
  }
  return extracted
}

export function mergeActivityIntoPbScan(
  state: PbScanState,
  activity: StravaActivityDetail,
  now = new Date(),
): PbScanState {
  if (state.scannedActivityIds.includes(activity.id)) return state

  const activityBests = extractPersonalBests(activity)
  const bests = { ...state.bests }
  for (const distance of Object.keys(PB_TARGETS) as PersonalBestDistance[]) {
    const candidate = activityBests[distance]
    const current = bests[distance]
    if (candidate && (!current || candidate.elapsedSeconds < current.elapsedSeconds)) {
      bests[distance] = candidate
    }
  }

  const scannedActivityIds = [...state.scannedActivityIds, activity.id]
  return {
    ...state,
    status: scannedActivityIds.length >= state.totalRunCount ? 'complete' : 'scanning',
    scannedActivityIds,
    bests,
    error: undefined,
    updatedAt: now.toISOString(),
  }
}

export function markPbScanError(state: PbScanState, error: string, now = new Date()): PbScanState {
  return { ...state, status: 'error', error, updatedAt: now.toISOString() }
}
