import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the public landing route', async () => {
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (path.includes('/api/owner-session')) {
        return Promise.resolve(new Response(JSON.stringify({ authenticated: false }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({
        version: 1,
        publishedAt: '2026-06-09T00:00:00.000Z',
        stats: {
          lifetimeMovementMiles: 0,
          lifetimeHours: 0,
          runCount: 0,
          longestRunMiles: 0,
          personalBests: { mile: null, fiveK: null, tenK: null, halfMarathon: null, marathon: null },
        },
        coaching: null,
        trends: { weeklyMileage: [], load: [], running: [] },
        recentActivities: [],
      }), { status: 200 }))
    }))

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /lifetime movement/i })).toBeInTheDocument()
    await screen.findByTestId('globe-renderer')
    await waitFor(() => expect(screen.queryByText(/loading published journey/i)).not.toBeInTheDocument())
  })

  it('treats a null owner-session response as unauthenticated', async () => {
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (path.includes('/api/owner-session')) {
        return Promise.resolve(new Response('null', { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({
        version: 1,
        publishedAt: '2026-06-09T00:00:00.000Z',
        stats: {
          lifetimeMovementMiles: 0,
          lifetimeHours: 0,
          runCount: 0,
          longestRunMiles: 0,
          personalBests: { mile: null, fiveK: null, tenK: null, halfMarathon: null, marathon: null },
        },
        coaching: null,
        trends: { weeklyMileage: [], load: [], running: [] },
        recentActivities: [],
      }), { status: 200 }))
    }))

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <App />
      </MemoryRouter>,
    )

    await screen.findByTestId('globe-renderer')
    await waitFor(() => expect(screen.queryByText(/loading published journey/i)).not.toBeInTheDocument())
    expect(screen.queryByText(/can't access property/i)).not.toBeInTheDocument()
  })
})
