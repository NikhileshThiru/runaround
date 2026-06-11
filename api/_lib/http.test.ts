import { describe, expect, it } from 'vitest'
import { requireSameOrigin, type ApiRequest } from './http'

describe('same-origin validation', () => {
  it('accepts an exact origin and host match', () => {
    const request: ApiRequest = {
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    }
    expect(requireSameOrigin(request)).toBe(true)
  })

  it('rejects missing, malformed, and cross-origin requests', () => {
    expect(requireSameOrigin({ headers: { host: 'localhost:3000' } })).toBe(false)
    expect(requireSameOrigin({ headers: { host: 'localhost:3000', origin: 'not-a-url' } })).toBe(false)
    expect(requireSameOrigin({
      headers: { host: 'localhost:3000', origin: 'https://attacker.example' },
    })).toBe(false)
  })
})
