import { useCallback, useEffect, useMemo, useState } from 'react'
import ActivityDetail from '@/components/Dashboard/ActivityDetail'
import ActivityFeed from '@/components/Dashboard/ActivityFeed'
import CoachingCard from '@/components/Dashboard/CoachingCard'
import TrainingTrends from '@/components/Dashboard/TrainingTrends'
import WeatherWidget from '@/components/Dashboard/WeatherWidget'
import Navbar from '@/components/shared/Navbar'
import RecoveryActions from '@/components/shared/RecoveryActions'
import { useAthlete } from '@/context/useAthlete'
import { toDisplayActivity, type DisplayActivity } from '@/lib/activityDisplay'
import { createActivityChartSeries, type ActivityChartSeries } from '@/lib/activityCharts'
import { deterministicSafeRecommendation } from '@/lib/coachingSafety'
import { getActivityDescription, getCoachingRecommendation } from '@/lib/gemini'
import { getOrFetchActivityDetail, getOrFetchStreams } from '@/lib/stravaSync'
import type { CoachingRecommendation } from '@/schemas/ai'
import type { StravaActivityDetail } from '@/schemas/strava'

const EMPTY_TRENDS = { weeklyMileage: [], load: [], running: [] }

export default function Dashboard() {
  const { mode, activities, profile, publicSnapshot, error } = useAthlete()
  const [selected, setSelected] = useState<DisplayActivity | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<StravaActivityDetail | null>(null)
  const [selectedCharts, setSelectedCharts] = useState<ActivityChartSeries | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [assessment, setAssessment] = useState<string | null>(null)
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [assessmentError, setAssessmentError] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<CoachingRecommendation | null>(null)
  const [coachingLoading, setCoachingLoading] = useState(false)
  const [coachingError, setCoachingError] = useState<string | null>(null)
  const displayActivities = useMemo(
    () => mode === 'owner' ? activities.slice(0, 50).map((activity) => toDisplayActivity(activity, activities)) : publicSnapshot?.recentActivities ?? [],
    [activities, mode, publicSnapshot],
  )
  const trends = mode === 'owner' && profile
    ? {
        weeklyMileage: profile.runningMetrics.weeklyMileageHistory.map((week) => ({
          ...week,
          baseline: profile.runningMetrics.typicalWeeklyMiles,
        })),
        load: profile.fitness.history,
        running: profile.runningMetrics.dailyRunningHistory,
      }
    : publicSnapshot?.trends ?? EMPTY_TRENDS

  const loadCoaching = useCallback(async (regenerate = false) => {
    if (mode === 'public') {
      setRecommendation(publicSnapshot?.coaching ?? null)
      setCoachingError(null)
      return
    }
    if (!profile) {
      setRecommendation(null)
      return
    }
    setCoachingLoading(true)
    setCoachingError(null)
    try {
      setRecommendation(await getCoachingRecommendation(profile, activities, { regenerate }))
    } catch {
      setRecommendation(deterministicSafeRecommendation(profile))
      setCoachingError('Gemini is unavailable, so this is the deterministic safety fallback.')
    } finally {
      setCoachingLoading(false)
    }
  }, [activities, mode, profile, publicSnapshot])

  useEffect(() => {
    void loadCoaching()
  }, [loadCoaching])

  async function selectActivity(activity: DisplayActivity) {
    setSelected(activity)
    setSelectedDetail(null)
    setDetailError(null)
    setAssessment(null)
    setAssessmentLoading(false)
    setAssessmentError(null)
    setSelectedCharts(activity.charts ? {
      pace: activity.charts.pace ?? [],
      heartRate: activity.charts.heartRate ?? [],
      cadence: activity.charts.cadence ?? [],
      power: [],
    } : null)
    if (mode !== 'owner' || !activity.id.startsWith('owner-')) return

    const activityId = Number(activity.id.slice('owner-'.length))
    if (!Number.isSafeInteger(activityId)) return
    setDetailLoading(true)
    try {
      const [detail, streams] = await Promise.all([
        getOrFetchActivityDetail(activityId),
        getOrFetchStreams(activityId, ['velocity_smooth', 'heartrate', 'cadence', 'watts']),
      ])
      setSelectedDetail(detail)
      setSelectedCharts(createActivityChartSeries(streams))
      setDetailLoading(false)
      if (profile) {
        setAssessmentLoading(true)
        try {
          setAssessment(await getActivityDescription(detail, profile))
        } catch {
          setAssessmentError('The AI assessment is temporarily unavailable. Activity data and charts are still available.')
        } finally {
          setAssessmentLoading(false)
        }
      }
    } catch (caught) {
      setDetailError(caught instanceof Error ? caught.message : 'Activity detail is unavailable.')
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="min-h-screen text-primary">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-10 px-5 py-9 lg:px-8 lg:py-12">
        <header className="flex flex-col justify-between gap-4 border-b border-white/[0.07] pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Training intelligence</p>
            <h1 className="mt-3 font-display text-3xl text-primary sm:text-4xl">Performance console</h1>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-secondary sm:text-right">
            Workload, recovery, conditions, and recent movement derived from observed activity data.
          </p>
        </header>
        {error && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-center text-sm text-warning">
            {error}
            <RecoveryActions />
          </div>
        )}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <CoachingCard
            recommendation={recommendation}
            loading={coachingLoading}
            error={coachingError}
            ownerMode={mode === 'owner'}
            onRefresh={() => void loadCoaching(true)}
          />
          <WeatherWidget enabled={mode === 'owner'} />
        </div>
        <TrainingTrends trends={trends} />
        <ActivityFeed activities={displayActivities} onSelect={(activity) => void selectActivity(activity)} />
      </main>
      <ActivityDetail
        activity={selected}
        detail={selectedDetail}
        charts={selectedCharts}
        loading={detailLoading}
        error={detailError}
        assessment={assessment}
        assessmentLoading={assessmentLoading}
        assessmentError={assessmentError}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
