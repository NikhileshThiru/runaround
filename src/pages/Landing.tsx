import { lazy, Suspense } from 'react'
import Navbar from '@/components/shared/Navbar'
import Quote from '@/components/shared/Quote'
import StatsBar from '@/components/shared/StatsBar'
import RecoveryActions from '@/components/shared/RecoveryActions'
import { useAthlete } from '@/context/useAthlete'
import { isRun } from '@/lib/athleteProfile'
import { emptyPersonalBests } from '@/lib/personalBests'

const GlobeViz = lazy(() => import('@/components/Globe/GlobeViz'))

export default function Landing() {
  const { activities, error, loading, mode, pbScan, profile, publicSnapshot, ownerAuthenticated } = useAthlete()
  const ownerStats = profile?.lifetimeStats
  const publicStats = publicSnapshot?.stats
  const lifetimeMiles = mode === 'owner'
    ? ownerStats?.lifetimeMovementMiles ?? 0
    : publicStats?.lifetimeMovementMiles ?? 0

  const stats = mode === 'owner' && profile
    ? {
        lifetimeMiles: profile.lifetimeStats.lifetimeMovementMiles,
        lifetimeHours: profile.lifetimeStats.lifetimeHours,
        runCount: profile.lifetimeStats.totalRunCount,
        longestRunMiles: Math.max(0, ...activities.filter(isRun).map((activity) => activity.distance / 1609.344)),
        personalBests: profile.personalBests,
      }
    : {
        lifetimeMiles: publicStats?.lifetimeMovementMiles ?? 0,
        lifetimeHours: publicStats?.lifetimeHours ?? 0,
        runCount: publicStats?.runCount ?? 0,
        longestRunMiles: publicStats?.longestRunMiles ?? 0,
        personalBests: publicStats?.personalBests ?? emptyPersonalBests(),
      }

  return (
    <div className="min-h-screen overflow-x-hidden text-primary">
      <Navbar />
      <main className="mx-auto max-w-7xl px-5 pb-16 pt-10 lg:px-8 lg:pt-12">
        <h1 className="sr-only">Lifetime movement journey</h1>
        <Quote />
        <div className="mt-9">
          <Suspense fallback={<div className="h-[60vh] min-h-[500px] rounded-2xl border border-white/[0.08] bg-surface/40" />}>
            <GlobeViz lifetimeMiles={lifetimeMiles} />
          </Suspense>
        </div>
        <div className="mt-6">
          <StatsBar {...stats} />
        </div>
        {mode === 'owner' && pbScan && pbScan.status !== 'complete' && (
          <p className="mt-4 text-center font-mono text-xs text-secondary">
            Exact PB scan: {pbScan.scannedActivityIds.length} / {pbScan.totalRunCount} runs inspected · {pbScan.status.replace('_', ' ')}
          </p>
        )}
        {loading && <p className="mt-5 text-center font-mono text-xs text-secondary">Loading published journey…</p>}
        {!loading && mode === 'public' && (error || !publicSnapshot) && (
          <div className="mt-5 rounded-xl border border-warning/25 bg-warning/10 px-5 py-4 text-center text-sm text-warning">
            {error ?? 'No public snapshot has been published yet.'}
            <RecoveryActions />
          </div>
        )}
        {!loading && ownerAuthenticated && !profile && (
          <div className="mt-5 flex justify-center">
            <a href="/api/strava-auth" className="primary-action px-5 py-3">
              Connect with Strava
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
