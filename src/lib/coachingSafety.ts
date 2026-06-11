import type { CoachingRecommendation } from '@/schemas/ai'
import type { AthleteProfile } from '@/schemas/athleteProfile'

export interface CoachingConstraints {
  maximumSafeDistanceMiles: number | null
  hardSessionAllowed: boolean
  forceRest: boolean
  baselineSufficient: boolean
}

export function coachingConstraints(profile: AthleteProfile): CoachingConstraints {
  const baseline = profile.runningMetrics.typicalWeeklyMiles
  const baselineSufficient = profile.runningMetrics.weeklyBaselineSufficient && baseline !== null
  return {
    maximumSafeDistanceMiles: baselineSufficient
      ? Math.max(0, baseline * 1.1 - profile.recentLoad.currentWeekMiles)
      : null,
    hardSessionAllowed: !profile.coachingFlags.hardEffortWithin48Hours,
    forceRest: profile.fitness.form < -20 || profile.coachingFlags.formBelowSafetyFloor,
    baselineSufficient,
  }
}

export function deterministicSafeRecommendation(profile: AthleteProfile): CoachingRecommendation {
  const constraints = coachingConstraints(profile)
  if (constraints.forceRest) {
    return {
      sessionType: 'Rest or recovery mobility',
      distanceOrDuration: 'No running mileage',
      targetEffort: 'Very easy',
      focus: 'Let acute fatigue fall before adding training stress.',
      reason: 'Current form is below the deterministic safety floor.',
      intensity: 'rest',
    }
  }
  if (!constraints.baselineSufficient) {
    return {
      sessionType: 'Conservative easy run',
      distanceOrDuration: '20–30 minutes',
      targetEffort: 'Conversational effort',
      focus: 'Collect consistent data without forcing progression.',
      reason: 'There is not enough completed-week history for a mileage progression.',
      intensity: 'easy',
    }
  }
  if (constraints.maximumSafeDistanceMiles === 0) {
    return {
      sessionType: 'Rest or low-impact recovery',
      distanceOrDuration: '20–40 minutes optional',
      targetEffort: 'Very easy',
      focus: 'Protect the current weekly load ceiling.',
      reason: 'Current running mileage has reached the deterministic weekly cap.',
      intensity: 'rest',
    }
  }
  return {
    sessionType: 'Easy aerobic run',
    distanceOrDuration: `Up to ${constraints.maximumSafeDistanceMiles!.toFixed(1)} miles`,
    targetEffort: 'Conversational effort',
    focus: 'Keep effort controlled and finish with reserve.',
    reason: constraints.hardSessionAllowed
      ? 'A conservative aerobic session fits the current workload.'
      : 'A recent hard effort rules out another hard session.',
    intensity: 'easy',
  }
}

function parseLeadingMiles(value: string): number | null {
  const match = value.match(/(?:up to\s*)?(\d+(?:\.\d+)?)\s*(?:mi|mile)/i)
  return match ? Number(match[1]) : null
}

export function validateRecommendationSafety(
  recommendation: CoachingRecommendation,
  profile: AthleteProfile,
): CoachingRecommendation {
  const constraints = coachingConstraints(profile)
  if (constraints.forceRest) return deterministicSafeRecommendation(profile)
  if (!constraints.hardSessionAllowed && recommendation.intensity === 'hard') {
    return deterministicSafeRecommendation(profile)
  }
  const proposedMiles = parseLeadingMiles(recommendation.distanceOrDuration)
  if (
    proposedMiles !== null
    && constraints.maximumSafeDistanceMiles !== null
    && proposedMiles > constraints.maximumSafeDistanceMiles + 0.05
  ) {
    return deterministicSafeRecommendation(profile)
  }
  return recommendation
}
