import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createOwnerSession,
  createPasswordHash,
  decryptStravaTokens,
  encryptStravaTokens,
  safeEqual,
  verifyOwnerSession,
  verifyPassword,
} from './security'

describe('security helpers', () => {
  const originalSecret = process.env.SESSION_SECRET

  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-session-secret-that-is-longer-than-thirty-two-characters'
  })

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret
  })

  it('creates verifiable, expiring owner sessions', () => {
    const now = Date.now()
    const session = createOwnerSession(now)
    expect(verifyOwnerSession(session, now + 1_000)).toBe(true)
    expect(verifyOwnerSession(session, now + 13 * 60 * 60 * 1000)).toBe(false)
    expect(verifyOwnerSession(`${session}x`, now)).toBe(false)
  })

  it('hashes and verifies owner passwords with scrypt', () => {
    const hash = createPasswordHash('a-long-owner-password')
    expect(verifyPassword('a-long-owner-password', hash)).toBe(true)
    expect(verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('encrypts and authenticates Strava token data', () => {
    const tokens = { accessToken: 'access', refreshToken: 'refresh', expiresAt: 12345 }
    const encrypted = encryptStravaTokens(tokens)
    expect(encrypted).not.toContain('access')
    expect(decryptStravaTokens(encrypted)).toEqual(tokens)
    expect(decryptStravaTokens(`${encrypted}x`)).toBeNull()
  })

  it('compares OAuth state without accepting missing values', () => {
    expect(safeEqual('same', 'same')).toBe(true)
    expect(safeEqual('same', 'different')).toBe(false)
    expect(safeEqual(undefined, undefined)).toBe(false)
  })
})
