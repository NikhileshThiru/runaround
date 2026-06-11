import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AthleteProfile, PbScanState } from '@/schemas/athleteProfile'
import type { StravaActivityDetail, StravaActivitySummary, StravaStream } from '@/schemas/strava'

export interface CachedStream extends StravaStream {
  cacheKey: string
  activityId: number
  streamType: string
}

export interface CachedDescription {
  activityId: number
  description: string
  createdAt: string
}

export interface SyncMetadata {
  key: string
  value: unknown
}

interface RunAroundDb extends DBSchema {
  activitySummaries: {
    key: number
    value: StravaActivitySummary
    indexes: { byStartDate: string }
  }
  activityDetails: {
    key: number
    value: StravaActivityDetail
  }
  streams: {
    key: string
    value: CachedStream
    indexes: { byActivityId: number }
  }
  profiles: {
    key: string
    value: AthleteProfile
  }
  pbScan: {
    key: string
    value: PbScanState
  }
  descriptions: {
    key: number
    value: CachedDescription
  }
  metadata: {
    key: string
    value: SyncMetadata
  }
}

export const RUNAROUND_DB_NAME = 'runaround_private'
export const RUNAROUND_DB_VERSION = 1

let databasePromise: Promise<IDBPDatabase<RunAroundDb>> | null = null

export function openRunAroundDb(): Promise<IDBPDatabase<RunAroundDb>> {
  databasePromise ??= openDB<RunAroundDb>(RUNAROUND_DB_NAME, RUNAROUND_DB_VERSION, {
    upgrade(database) {
      const summaries = database.createObjectStore('activitySummaries', { keyPath: 'id' })
      summaries.createIndex('byStartDate', 'start_date')
      database.createObjectStore('activityDetails', { keyPath: 'id' })
      const streams = database.createObjectStore('streams', { keyPath: 'cacheKey' })
      streams.createIndex('byActivityId', 'activityId')
      database.createObjectStore('profiles')
      database.createObjectStore('pbScan')
      database.createObjectStore('descriptions', { keyPath: 'activityId' })
      database.createObjectStore('metadata', { keyPath: 'key' })
    },
  })
  return databasePromise
}

export async function putActivitySummaries(activities: readonly StravaActivitySummary[]): Promise<void> {
  const database = await openRunAroundDb()
  const transaction = database.transaction('activitySummaries', 'readwrite')
  await Promise.all([...activities.map((activity) => transaction.store.put(activity)), transaction.done])
}

export async function getActivitySummariesNewestFirst(): Promise<StravaActivitySummary[]> {
  const database = await openRunAroundDb()
  const values = await database.getAllFromIndex('activitySummaries', 'byStartDate')
  return values.reverse()
}

export async function clearActivityData(): Promise<void> {
  const database = await openRunAroundDb()
  const transaction = database.transaction(
    ['activitySummaries', 'activityDetails', 'streams', 'profiles', 'pbScan', 'descriptions', 'metadata'],
    'readwrite',
  )
  await Promise.all([
    transaction.objectStore('activitySummaries').clear(),
    transaction.objectStore('activityDetails').clear(),
    transaction.objectStore('streams').clear(),
    transaction.objectStore('profiles').clear(),
    transaction.objectStore('pbScan').clear(),
    transaction.objectStore('descriptions').clear(),
    transaction.objectStore('metadata').clear(),
    transaction.done,
  ])
}

export async function putActivityDetail(activity: StravaActivityDetail): Promise<void> {
  const database = await openRunAroundDb()
  await database.put('activityDetails', activity)
}

export async function getActivityDetail(activityId: number): Promise<StravaActivityDetail | undefined> {
  const database = await openRunAroundDb()
  return database.get('activityDetails', activityId)
}

export async function putStream(activityId: number, streamType: string, stream: StravaStream): Promise<void> {
  const database = await openRunAroundDb()
  await database.put('streams', {
    ...stream,
    cacheKey: `${activityId}:${streamType}`,
    activityId,
    streamType,
  })
}

export async function getStream(activityId: number, streamType: string): Promise<CachedStream | undefined> {
  const database = await openRunAroundDb()
  return database.get('streams', `${activityId}:${streamType}`)
}

export async function getStreamsForActivity(activityId: number): Promise<CachedStream[]> {
  const database = await openRunAroundDb()
  return database.getAllFromIndex('streams', 'byActivityId', activityId)
}

export async function putCurrentProfile(profile: AthleteProfile): Promise<void> {
  const database = await openRunAroundDb()
  await database.put('profiles', profile, 'current')
}

export async function getCurrentProfile(): Promise<AthleteProfile | undefined> {
  const database = await openRunAroundDb()
  return database.get('profiles', 'current')
}

export async function putPbScanState(state: PbScanState): Promise<void> {
  const database = await openRunAroundDb()
  await database.put('pbScan', state, 'current')
}

export async function getPbScanState(): Promise<PbScanState | undefined> {
  const database = await openRunAroundDb()
  return database.get('pbScan', 'current')
}

export async function setMetadata(key: string, value: unknown): Promise<void> {
  const database = await openRunAroundDb()
  await database.put('metadata', { key, value })
}

export async function getMetadata<T>(key: string): Promise<T | undefined> {
  const database = await openRunAroundDb()
  const record = await database.get('metadata', key)
  return record?.value as T | undefined
}

export async function deleteRunAroundDb(): Promise<void> {
  const database = await databasePromise
  database?.close()
  databasePromise = null
  await deleteDB(RUNAROUND_DB_NAME)
}
