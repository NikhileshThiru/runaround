import { useEffect, useState } from 'react'
import { fetchKudosCount, giveKudos, hasGivenKudos, rememberKudosGiven } from '@/lib/kudos'

/**
 * Strava-style kudos for the whole journey. The counter is shared across all
 * visitors; the server allows one kudos per visitor per day. The button stays
 * hidden until the counter service responds, so an unprovisioned or failing
 * backend never shows a broken control.
 */
export default function KudosButton() {
  const [count, setCount] = useState<number | null>(null)
  const [given, setGiven] = useState(hasGivenKudos)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchKudosCount()
      .then((result) => { if (!cancelled) setCount(result.count) })
      .catch(() => {
        // Leave count null: the button does not render without a live counter.
      })
    return () => { cancelled = true }
  }, [])

  if (count === null) return null

  async function submit(): Promise<void> {
    if (given || sending) return
    setSending(true)
    setGiven(true)
    setCount((current) => (current ?? 0) + 1)
    try {
      const result = await giveKudos()
      setCount(result.count)
      rememberKudosGiven()
    } catch {
      // Roll back the optimistic update so the displayed total stays truthful.
      setGiven(false)
      setCount((current) => Math.max(0, (current ?? 1) - 1))
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void submit()}
      disabled={given || sending}
      aria-label={given ? `Kudos given. ${count} total kudos` : `Give kudos. ${count} total kudos`}
      title={given ? 'Kudos given — thank you' : 'Give kudos'}
      className={`group flex items-center gap-2 border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon disabled:cursor-default ${
        given
          ? 'border-glow/50 bg-neon/10 text-glow'
          : 'border-white/15 text-secondary hover:border-glow/50 hover:text-glow'
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`h-3.5 w-3.5 transition ${given ? 'fill-glow stroke-glow' : 'fill-none stroke-current group-hover:stroke-glow'}`}
        strokeWidth="1.8"
        strokeLinejoin="round"
      >
        <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4-7.5a2 2 0 0 1 2 2V9h5.1a2 2 0 0 1 2 2.4l-1.2 6A2 2 0 0 1 17 19l-10 1" />
      </svg>
      <span>Kudos</span>
      <span className={given ? 'text-glow' : 'text-primary'}>{count.toLocaleString()}</span>
    </button>
  )
}
