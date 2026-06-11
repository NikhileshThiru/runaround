import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import {
  getActivitySummariesNewestFirst,
  getCurrentProfile,
  getPbScanState,
  putCurrentProfile,
} from '@/db/runaroundDb'
import type { AthleteProfile, PbScanState } from '@/schemas/athleteProfile'
import { publicSnapshotSchema, type PublicSnapshot } from '@/schemas/publicSnapshot'
import type { StravaActivitySummary } from '@/schemas/strava'
import { computeAthleteProfile } from '@/lib/athleteProfile'
import { disconnectAndDeleteLocalData, getOwnerSession, ownerLogin, ownerLogout } from '@/lib/owner'
import { resumePersonalBestScan, syncActivitySummaries, type SyncResult } from '@/lib/stravaSync'
import { AthleteContext, type AppMode, type AthleteContextValue } from './athleteContextValue'

async function loadPublicSnapshot(): Promise<PublicSnapshot> {
  const response = await fetch('/data/snapshot.json', { cache: 'no-cache' })
  if (!response.ok) throw new Error('The public snapshot is unavailable.')
  return publicSnapshotSchema.parse(await response.json())
}

export function AthleteProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<AppMode>('public')
  const [ownerAuthenticated, setOwnerAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publicSnapshot, setPublicSnapshot] = useState<PublicSnapshot | null>(null)
  const [activities, setActivities] = useState<StravaActivitySummary[]>([])
  const [profile, setProfile] = useState<AthleteProfile | null>(null)
  const [pbScan, setPbScan] = useState<PbScanState | null>(null)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const autoSyncStarted = useRef(false)

  const hydrateOwnerCache = useCallback(async () => {
    const [cachedActivities, cachedProfile, cachedPbScan] = await Promise.all([
      getActivitySummariesNewestFirst(),
      getCurrentProfile(),
      getPbScanState(),
    ])
    setActivities(cachedActivities)
    setPbScan(cachedPbScan ?? null)
    if (cachedProfile) {
      setProfile(cachedProfile)
    } else if (cachedActivities.length) {
      const computed = computeAthleteProfile(cachedActivities, cachedPbScan)
      await putCurrentProfile(computed)
      setProfile(computed)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const currentUrl = new URL(window.location.href)
    if (currentUrl.searchParams.has('strava')) {
      currentUrl.searchParams.delete('strava')
      window.history.replaceState(window.history.state, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
    }
    Promise.allSettled([loadPublicSnapshot(), getOwnerSession()])
      .then(async ([snapshotResult, ownerResult]) => {
        if (cancelled) return
        if (snapshotResult.status === 'fulfilled') setPublicSnapshot(snapshotResult.value)
        else setError(snapshotResult.reason instanceof Error ? snapshotResult.reason.message : 'Invalid public snapshot.')

        if (ownerResult.status === 'fulfilled' && ownerResult.value?.authenticated === true) {
          await hydrateOwnerCache()
          if (!cancelled) {
            setOwnerAuthenticated(true)
            setMode('owner')
          }
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to initialize RunAround.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [hydrateOwnerCache])

  const unlockOwner = useCallback(async (password: string) => {
    setError(null)
    const session = await ownerLogin(password)
    if (!session.authenticated) throw new Error('Owner session was not established.')
    await hydrateOwnerCache()
    autoSyncStarted.current = false
    setOwnerAuthenticated(true)
    setMode('owner')
  }, [hydrateOwnerCache])

  const lockOwner = useCallback(async () => {
    await ownerLogout()
    setOwnerAuthenticated(false)
    setMode('public')
    setActivities([])
    setProfile(null)
    setPbScan(null)
    autoSyncStarted.current = false
  }, [])

  const disconnectStrava = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      await disconnectAndDeleteLocalData()
      setOwnerAuthenticated(false)
      setMode('public')
      setActivities([])
      setProfile(null)
      setPbScan(null)
      setLastSyncResult(null)
      autoSyncStarted.current = false
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to disconnect Strava.')
      throw caught
    } finally {
      setSyncing(false)
    }
  }, [])

  const sync = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      const result = await syncActivitySummaries()
      setLastSyncResult(result)
      const [nextActivities, nextPbScan] = await Promise.all([
        getActivitySummariesNewestFirst(),
        getPbScanState(),
      ])
      const nextProfile = computeAthleteProfile(nextActivities, nextPbScan)
      await putCurrentProfile(nextProfile)
      setActivities(nextActivities)
      setPbScan(nextPbScan ?? null)
      setProfile(nextProfile)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Strava sync failed.')
      throw caught
    } finally {
      setSyncing(false)
    }
  }, [])

  const resumePbScan = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      await resumePersonalBestScan()
      const [nextPbScan, nextActivities] = await Promise.all([
        getPbScanState(),
        getActivitySummariesNewestFirst(),
      ])
      const nextProfile = computeAthleteProfile(nextActivities, nextPbScan)
      await putCurrentProfile(nextProfile)
      setPbScan(nextPbScan ?? null)
      setProfile(nextProfile)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Personal-best scan failed.')
      throw caught
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    if (!ownerAuthenticated || autoSyncStarted.current) return
    autoSyncStarted.current = true
    void (async () => {
      try {
        await sync()
        await resumePbScan()
      } catch {
        // Both operations publish their own recoverable error state.
      }
    })()
  }, [ownerAuthenticated, resumePbScan, sync])

  const value = useMemo<AthleteContextValue>(() => ({
    mode,
    ownerAuthenticated,
    loading,
    syncing,
    error,
    publicSnapshot,
    activities,
    profile,
    pbScan,
    lastSyncResult,
    unlockOwner,
    lockOwner,
    disconnectStrava,
    sync,
    resumePbScan,
  }), [
    activities, disconnectStrava, error, lastSyncResult, loading, lockOwner, mode, ownerAuthenticated, pbScan,
    profile, publicSnapshot, resumePbScan, sync, syncing, unlockOwner,
  ])

  return <AthleteContext.Provider value={value}>{children}</AthleteContext.Provider>
}
