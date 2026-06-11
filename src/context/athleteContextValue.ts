import { createContext } from 'react'
import type { SyncResult } from '@/lib/stravaSync'
import type { AthleteProfile, PbScanState } from '@/schemas/athleteProfile'
import type { PublicSnapshot } from '@/schemas/publicSnapshot'
import type { StravaActivitySummary } from '@/schemas/strava'

export type AppMode = 'public' | 'owner'

export interface AthleteContextValue {
  mode: AppMode
  ownerAuthenticated: boolean
  loading: boolean
  syncing: boolean
  error: string | null
  publicSnapshot: PublicSnapshot | null
  activities: StravaActivitySummary[]
  profile: AthleteProfile | null
  pbScan: PbScanState | null
  lastSyncResult: SyncResult | null
  unlockOwner: (password: string) => Promise<void>
  lockOwner: () => Promise<void>
  disconnectStrava: () => Promise<void>
  sync: () => Promise<void>
  resumePbScan: () => Promise<void>
}

export const AthleteContext = createContext<AthleteContextValue | null>(null)
