import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import type { ApiRequest } from './http.js'
import { cookies } from './http.js'

export const OWNER_COOKIE = 'runaround_owner'
export const STRAVA_TOKEN_COOKIE = 'runaround_strava'
export const OAUTH_STATE_COOKIE = 'runaround_oauth_state'

interface OwnerSession {
  version: 1
  expiresAt: number
  nonce: string
}

export interface StravaTokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

function requireSecret(name: 'SESSION_SECRET'): string {
  const value = process.env[name]
  if (!value || value.length < 32) throw new Error(`${name} must contain at least 32 characters.`)
  return value
}

function encode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

function decode(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

function hmac(value: string): Buffer {
  return createHmac('sha256', requireSecret('SESSION_SECRET')).update(value).digest()
}

export function createOwnerSession(now = Date.now()): string {
  const payload: OwnerSession = {
    version: 1,
    expiresAt: now + 12 * 60 * 60 * 1000,
    nonce: randomBytes(16).toString('base64url'),
  }
  const encodedPayload = encode(JSON.stringify(payload))
  return `${encodedPayload}.${encode(hmac(encodedPayload))}`
}

export function verifyOwnerSession(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false
  const [encodedPayload, encodedSignature, extra] = token.split('.')
  if (!encodedPayload || !encodedSignature || extra) return false

  try {
    const supplied = decode(encodedSignature)
    const expected = hmac(encodedPayload)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false
    const payload = JSON.parse(decode(encodedPayload).toString('utf8')) as Partial<OwnerSession>
    return payload.version === 1
      && typeof payload.expiresAt === 'number'
      && payload.expiresAt > now
      && typeof payload.nonce === 'string'
  } catch {
    return false
  }
}

export function isOwnerRequest(request: ApiRequest): boolean {
  return verifyOwnerSession(cookies(request)[OWNER_COOKIE])
}

export function createPasswordHash(password: string): string {
  if (password.length < 12) throw new Error('Owner password must contain at least 12 characters.')
  const salt = randomBytes(16)
  const cost = 16_384
  const blockSize = 8
  const parallelization = 1
  const derived = scryptSync(password, salt, 32, { N: cost, r: blockSize, p: parallelization })
  return `scrypt$${cost}$${blockSize}$${parallelization}$${encode(salt)}$${encode(derived)}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, costText, blockText, parallelText, saltText, hashText, extra] = storedHash.split('$')
  if (algorithm !== 'scrypt' || !costText || !blockText || !parallelText || !saltText || !hashText || extra) {
    return false
  }

  const cost = Number(costText)
  const blockSize = Number(blockText)
  const parallelization = Number(parallelText)
  if (![cost, blockSize, parallelization].every(Number.isSafeInteger)) return false
  if (cost < 16_384 || cost > 1_048_576 || blockSize < 8 || parallelization < 1) return false

  try {
    const expected = decode(hashText)
    const actual = scryptSync(password, decode(saltText), expected.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: 128 * 1024 * 1024,
    })
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

function encryptionKey(): Buffer {
  return createHash('sha256').update(requireSecret('SESSION_SECRET')).update('strava-token-v1').digest()
}

export function encryptStravaTokens(tokens: StravaTokenSet): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1.${encode(iv)}.${encode(ciphertext)}.${encode(tag)}`
}

export function decryptStravaTokens(value: string | undefined): StravaTokenSet | null {
  if (!value) return null
  const [version, ivText, ciphertextText, tagText, extra] = value.split('.')
  if (version !== 'v1' || !ivText || !ciphertextText || !tagText || extra) return null

  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), decode(ivText))
    decipher.setAuthTag(decode(tagText))
    const plaintext = Buffer.concat([decipher.update(decode(ciphertextText)), decipher.final()]).toString('utf8')
    const parsed = JSON.parse(plaintext) as Partial<StravaTokenSet>
    if (
      typeof parsed.accessToken !== 'string'
      || typeof parsed.refreshToken !== 'string'
      || typeof parsed.expiresAt !== 'number'
    ) return null
    return parsed as StravaTokenSet
  } catch {
    return null
  }
}

export function randomState(): string {
  return randomBytes(32).toString('base64url')
}

export function safeEqual(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
