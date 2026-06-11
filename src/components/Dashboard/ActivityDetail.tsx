import { useEffect } from 'react'
import type { DisplayActivity } from '@/lib/activityDisplay'
import { formatDuration, formatPace, formatSportName } from '@/lib/activityDisplay'
import type { ActivityChartSeries } from '@/lib/activityCharts'
import type { StravaActivityDetail } from '@/schemas/strava'
import MetricChart from '@/components/Charts/MetricChart'

export default function ActivityDetail({
  activity,
  detail,
  charts,
  loading,
  error,
  assessment,
  assessmentLoading,
  assessmentError,
  onClose,
}: {
  activity: DisplayActivity | null
  detail?: StravaActivityDetail | null
  charts?: ActivityChartSeries | null
  loading?: boolean
  error?: string | null
  assessment?: string | null
  assessmentLoading?: boolean
  assessmentError?: string | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!activity) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activity, onClose])

  if (!activity) return null
  const metrics = [
    ['Distance', activity.distanceMiles ? `${activity.distanceMiles.toFixed(2)} mi` : '—'],
    ['Moving time', formatDuration(activity.durationSeconds)],
    ['Average pace', formatPace(activity.averagePaceSecondsPerMile)],
    ['Average HR', activity.averageHeartRate ? `${Math.round(activity.averageHeartRate)} bpm` : '—'],
    ['Cadence', activity.averageCadence ? `${Math.round(activity.averageCadence)} spm` : '—'],
    ['Elevation', detail ? `${Math.round(detail.total_elevation_gain * 3.28084)} ft` : '—'],
    ['Max HR', detail?.max_heartrate ? `${Math.round(detail.max_heartrate)} bpm` : '—'],
    ['Power', detail?.average_watts ? `${Math.round(detail.average_watts)} W` : '—'],
  ]

  return (
    <div className="fixed inset-0 z-50 bg-void/55 backdrop-blur-sm" onMouseDown={onClose}>
      <aside
        className="ml-auto h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-void p-6 shadow-[-24px_0_70px_rgba(0,0,0,.45)] sm:p-8"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Activity detail"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{activity.date}</p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-primary">{formatSportName(activity.sportType)}</h2>
          </div>
          <button autoFocus onClick={onClose} className="nav-button text-secondary" aria-label="Close activity detail">Close</button>
        </div>
        <p className="mt-5 text-secondary">{activity.summary}</p>
        {activity.intensity && (
          <div className="mt-4 border border-white/10 bg-surface/50 p-3.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-secondary">Measured effort · {activity.intensity}</p>
            <p className="mt-2 text-xs leading-relaxed text-secondary">{activity.intensityBasis}</p>
          </div>
        )}
        {assessmentLoading && <div className="mt-5 h-20 animate-pulse border border-neon/15 bg-neon/5" />}
        {!assessmentLoading && assessment && (
          <div className="mt-5 border border-neon/20 bg-neon/5 p-3.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-glow">AI assessment</p>
            <p className="mt-2 text-sm leading-relaxed text-primary">{assessment}</p>
          </div>
        )}
        {!assessmentLoading && assessmentError && (
          <p className="mt-4 text-xs text-warning">{assessmentError}</p>
        )}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {metrics.map(([label, value]) => (
            <div key={label} className="border border-white/10 bg-surface/70 p-3">
              <p className="font-mono text-xs text-primary">{value}</p>
              <p className="mt-2 text-[9px] uppercase tracking-widest text-secondary">{label}</p>
            </div>
          ))}
        </div>
        {loading && <div className="mt-8 h-52 animate-pulse border border-white/10 bg-surface/60" />}
        {!loading && error && (
          <div className="mt-8 border border-warning/25 bg-warning/10 p-5 text-sm text-warning">{error}</div>
        )}
        {!loading && charts && (
          <div className="mt-8 space-y-4">
            <MetricChart title="Pace" points={charts.pace} color="#67d8f5" unit="/mi" formatter={formatChartPace} reversedY />
            <MetricChart title="Heart rate" points={charts.heartRate} color="#f47867" unit="bpm" />
            <MetricChart title="Cadence" points={charts.cadence} color="#56d8a4" unit="spm" />
            <MetricChart title="Power" points={charts.power} color="#6d9ef7" unit="W" />
          </div>
        )}
        {!loading && !error && !charts && (
          <div className="mt-8 border border-dashed border-white/10 p-8 text-center text-sm text-secondary">
            Detailed chart streams are unavailable in this view.
          </div>
        )}
      </aside>
    </div>
  )
}

function formatChartPace(seconds: number): string {
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const remaining = (total % 60).toString().padStart(2, '0')
  return `${minutes}:${remaining}/mi`
}
