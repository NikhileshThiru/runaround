import { useEffect, useState, type FormEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { useAthlete } from '@/context/useAthlete'

export default function Navbar() {
  const { disconnectStrava, mode, ownerAuthenticated, syncing, unlockOwner, lockOwner, sync } = useAthlete()
  const [showUnlock, setShowUnlock] = useState(false)
  const [showDisconnect, setShowDisconnect] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  const modalOpen = showUnlock || showDisconnect

  useEffect(() => {
    if (!modalOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setShowUnlock(false)
      setShowDisconnect(false)
      setPassword('')
      setError(null)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [modalOpen])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setUnlocking(true)
    try {
      await unlockOwner(password)
      setPassword('')
      setShowUnlock(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to unlock owner mode.')
    } finally {
      setUnlocking(false)
    }
  }

  function openUnlock() {
    setError(null)
    setShowUnlock(true)
  }

  function closeUnlock() {
    setError(null)
    setPassword('')
    setShowUnlock(false)
  }

  function openDisconnect() {
    setError(null)
    setShowDisconnect(true)
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.07] bg-void/85 backdrop-blur-xl">
        <nav className="relative mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-y-2 px-5 py-2.5 sm:flex-nowrap sm:py-0 lg:px-8">
          <NavLink to="/" className="group flex items-center gap-2.5 font-display text-sm font-semibold tracking-[0.14em] text-primary">
            <span className="status-dot" aria-hidden="true" />
            <span>RUN<span className="text-glow">AROUND</span></span>
          </NavLink>
          <div className="order-last flex w-full items-center justify-center gap-1 border-t border-white/[0.06] pt-2 sm:absolute sm:left-1/2 sm:top-1/2 sm:order-none sm:w-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:border-0 sm:pt-0">
            <NavItem to="/">Journey</NavItem>
            <NavItem to="/dashboard">Dashboard</NavItem>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="mr-1 flex items-center gap-1.5 border border-white/10 bg-white/[0.02] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.2em] text-secondary">
              <span className={`h-1 w-1 rounded-full ${ownerAuthenticated ? 'bg-warning' : 'bg-success'}`} aria-hidden="true" />
              {mode}
            </span>
            {ownerAuthenticated ? (
              <>
                <button className="nav-button font-mono text-[10px] uppercase tracking-[0.14em] text-glow" onClick={() => void sync()} disabled={syncing}>
                  {syncing ? 'Syncing' : 'Sync'}
                </button>
                <button className="nav-button font-mono text-[10px] uppercase tracking-[0.14em]" onClick={() => void lockOwner()}>Lock</button>
                <button className="nav-button font-mono text-[10px] uppercase tracking-[0.14em] text-warning" onClick={openDisconnect}>Disconnect</button>
              </>
            ) : (
              <button className="nav-button border border-white/[0.08] font-mono text-[10px] uppercase tracking-[0.14em] text-secondary" onClick={openUnlock}>Owner</button>
            )}
          </div>
        </nav>
      </header>
      {/* Spacer matching the fixed header: two stacked rows on mobile, one row from sm up. */}
      <div aria-hidden="true" className="h-[96px] sm:h-14" />

      {showUnlock && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-void/88 px-5 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="owner-unlock-title" onMouseDown={closeUnlock}>
          <form onSubmit={(event) => void submit(event)} className="panel w-full max-w-sm p-6" onMouseDown={(event) => event.stopPropagation()}>
            <p className="eyebrow">Private controls</p>
            <h2 id="owner-unlock-title" className="mt-3 font-display text-xl font-semibold tracking-tight text-primary">Unlock owner mode</h2>
            <p className="mt-2 text-sm text-secondary">Public visitors cannot sync Strava or call AI services.</p>
            <label className="mt-6 block text-xs uppercase tracking-wider text-secondary" htmlFor="owner-password">Password</label>
            <input
              id="owner-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-sm border border-white/10 bg-void/85 px-4 py-3 font-mono text-sm text-primary outline-none transition focus:border-neon/70 focus:ring-2 focus:ring-neon/10"
              autoFocus
            />
            {error && <p className="mt-3 text-sm text-warning" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="nav-button" onClick={closeUnlock}>Cancel</button>
              <button type="submit" className="primary-action" disabled={unlocking || password.length === 0}>{unlocking ? 'Unlocking' : 'Unlock'}</button>
            </div>
          </form>
        </div>
      )}

      {showDisconnect && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-void/88 px-5 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="disconnect-title" onMouseDown={() => setShowDisconnect(false)}>
          <div className="panel w-full max-w-md border-warning/25 p-6" onMouseDown={(event) => event.stopPropagation()}>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-warning">Destructive owner action</p>
            <h2 id="disconnect-title" className="mt-3 font-display text-xl font-semibold tracking-tight text-primary">Disconnect Strava?</h2>
            <p className="mt-3 text-sm leading-relaxed text-secondary">
              This revokes Strava access, clears private cookies, deletes local IndexedDB activity data, and removes cached coaching recommendations. The published public snapshot is unchanged.
            </p>
            {error && <p className="mt-3 text-sm text-warning" role="alert">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="nav-button" onClick={() => setShowDisconnect(false)}>Cancel</button>
              <button
                type="button"
                className="rounded-sm border border-warning/50 bg-warning/10 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-warning"
                disabled={syncing}
                onClick={() => void disconnectStrava().then(() => setShowDisconnect(false)).catch((caught: unknown) => {
                  setError(caught instanceof Error ? caught.message : 'Unable to disconnect Strava.')
                })}
              >
                {syncing ? 'Disconnecting' : 'Disconnect and delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-button relative font-mono text-[10px] uppercase tracking-[0.18em] ${isActive ? 'text-glow after:absolute after:inset-x-3 after:-bottom-[9px] after:h-px after:bg-glow sm:after:-bottom-[10px]' : 'text-secondary'}`}
    >
      {children}
    </NavLink>
  )
}
