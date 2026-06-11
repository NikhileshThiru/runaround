import type { CoachingRecommendation } from '@/schemas/ai'

export default function CoachingCard({ recommendation, loading = false, error, ownerMode = false, onRefresh }: {
  recommendation: CoachingRecommendation | null
  loading?: boolean
  error?: string | null
  ownerMode?: boolean
  onRefresh?: () => void
}) {
  return (
    <section className="panel hud-corners relative overflow-hidden border-neon/20 p-5 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="console-label"><b>A</b> Coaching directive</p>
        {recommendation && (
          <span className={`border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.2em] ${intensityTone(recommendation.intensity)}`}>
            {recommendation.intensity}
          </span>
        )}
      </div>
      <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-primary">What should you run today?</h2>
      {loading ? (
        <div className="mt-4 h-32 animate-pulse border border-white/[0.06] bg-void/55" />
      ) : recommendation ? (
        <div className="relative mt-4 grid gap-4 sm:grid-cols-3">
          <CoachingMetric label="Session" value={recommendation.sessionType} />
          <CoachingMetric label="Distance" value={recommendation.distanceOrDuration} />
          <CoachingMetric label="Effort" value={recommendation.targetEffort} />
          <div className="border border-white/[0.07] bg-void/55 p-3.5 sm:col-span-3">
            <p className="text-sm font-medium text-primary">{recommendation.focus}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-secondary">{recommendation.reason}</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-secondary">
          No coaching recommendation has been published yet. Owner mode generates one only after current workload and safety constraints are evaluated.
        </p>
      )}
      {error && <p className="mt-3 text-xs leading-relaxed text-warning">{error}</p>}
      {ownerMode && onRefresh && (
        <button type="button" className="primary-action relative mt-4" onClick={onRefresh} disabled={loading}>
          Recheck after sync
        </button>
      )}
    </section>
  )
}

function intensityTone(intensity: CoachingRecommendation['intensity']): string {
  if (intensity === 'hard') return 'border-warning/40 text-warning'
  if (intensity === 'moderate') return 'border-glow/40 text-glow'
  return 'border-success/40 text-success'
}

function CoachingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/[0.06] bg-void/40 p-3.5">
      <p className="instrument-label">{label}</p>
      <p className="mt-1.5 text-sm font-medium text-primary">{value}</p>
    </div>
  )
}
