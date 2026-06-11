import { Component, type ReactNode } from 'react'
import RecoveryActions from './RecoveryActions'

interface ErrorBoundaryState {
  failed: boolean
}

export default class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="grid min-h-screen place-items-center bg-void px-5 text-primary">
        <section className="panel w-full max-w-lg border-warning/25 p-7 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-warning">Recovery mode</p>
          <h1 className="mt-3 font-display text-2xl">RunAround could not render this view</h1>
          <p className="mt-3 text-sm leading-relaxed text-secondary">
            Reload first. If the problem persists, reset only the private browser cache and synchronize again.
          </p>
          <RecoveryActions />
        </section>
      </main>
    )
  }
}
