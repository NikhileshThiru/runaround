import { describe, expect, it, vi } from 'vitest'
import handler from './health'

describe('health function', () => {
  it('returns a successful JSON response', () => {
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))

    handler({}, { status })

    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith({ ok: true })
  })
})
