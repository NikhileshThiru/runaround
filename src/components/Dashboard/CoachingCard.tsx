import type { CoachingRecommendation } from '@/schemas/ai'

export default function CoachingCard({ recommendation, loading = false, error, ownerMode = false, onRefresh }: {
  recommendation: CoachingRecommendation | null
  loading?: boolean
  error?: string | null
  ownerMode?: boolean
  onRefresh?: () => void
}) {
  return (
    <section className="panel relative overflow-hidden border-neon/20 p-6 lg:p-8">
      <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-glow/80 to-transparent" />
      <p className="eyebrow">Adaptive coaching</p>
      <h2 className="mt-3 font-display text-2xl text-primary">What should you run today?</h2>
      {loading ? (
        <div className="mt-6 h-36 animate-pulse rounded-xl border border-white/[0.06] bg-void/55" />
      ) : recommendation ? (
        <div className="relative mt-6 grid gap-5 sm:grid-cols-3">
          <CoachingMetric label="Session" value={recommendation.sessionType} />
          <CoachingMetric label="Distance" value={recommendation.distanceOrDuration} />
          <CoachingMetric label="Effort" value={recommendation.targetEffort} />
          <div className="rounded-xl border border-white/[0.07] bg-void/55 p-4 sm:col-span-3">
            <p className="text-sm font-medium text-primary">{recommendation.focus}</p>
            <p className="mt-2 text-sm leading-relaxed text-secondary">{recommendation.reason}</p>
          </div>
        </div>
      ) : (
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-secondary">
          No coaching recommendation has been published yet. Owner mode generates one only after current workload and safety constraints are evaluated.
        </p>
      )}
      {error && <p className="mt-4 text-xs leading-relaxed text-warning">{error}</p>}
      {ownerMode && onRefresh && (
        <button type="button" className="primary-action relative mt-5" onClick={onRefresh} disabled={loading}>
          Recheck after sync
        </button>
      )}
    </section>
  )
}

function CoachingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="instrument-label">{label}</p>
      <p className="mt-2 font-medium text-primary">{value}</p>
    </div>
  )
}
