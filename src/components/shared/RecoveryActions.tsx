import { resetLocalPrivateData } from '@/lib/owner'

export default function RecoveryActions() {
  async function reset(): Promise<void> {
    if (!window.confirm('Delete the private local cache and reload RunAround? Published public data will not change.')) return
    await resetLocalPrivateData()
    window.location.reload()
  }

  return (
    <div className="mt-4 flex flex-wrap justify-center gap-3">
      <button type="button" className="nav-button border border-white/10" onClick={() => window.location.reload()}>
        Reload
      </button>
      <button type="button" className="nav-button border border-warning/30 text-warning" onClick={() => void reset()}>
        Reset local cache
      </button>
    </div>
  )
}
