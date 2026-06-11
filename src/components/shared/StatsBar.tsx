import { useCountUp } from '@/hooks/useCountUp'
import type { PersonalBests } from '@/schemas/athleteProfile'

interface StatsBarProps {
  lifetimeMiles: number
  lifetimeHours: number
  runCount: number
  longestRunMiles: number
  personalBests: PersonalBests | {
    mile: { elapsedSeconds: number } | null
    fiveK: { elapsedSeconds: number } | null
    tenK: { elapsedSeconds: number } | null
    halfMarathon: { elapsedSeconds: number } | null
    marathon: { elapsedSeconds: number } | null
  }
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—'
  // Round the total first so a 59.6-second remainder cannot render as :60.
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remaining = total % 60
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`
    : `${minutes}:${remaining.toString().padStart(2, '0')}`
}

type StatEntry =
  | { label: string; value: string }
  | { label: string; countTo: number; format: (value: number) => string }

export default function StatsBar(props: StatsBarProps) {
  const stats: StatEntry[] = [
    {
      label: 'Movement',
      countTo: props.lifetimeMiles,
      format: (value) => `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} mi`,
    },
    {
      label: 'Hours',
      countTo: props.lifetimeHours,
      format: (value) => value.toLocaleString(undefined, { maximumFractionDigits: 0 }),
    },
    { label: 'Runs', countTo: props.runCount, format: (value) => Math.round(value).toLocaleString() },
    { label: 'Mile', value: formatDuration(props.personalBests.mile?.elapsedSeconds) },
    { label: '5K', value: formatDuration(props.personalBests.fiveK?.elapsedSeconds) },
    { label: '10K', value: formatDuration(props.personalBests.tenK?.elapsedSeconds) },
    { label: 'Half', value: formatDuration(props.personalBests.halfMarathon?.elapsedSeconds) },
    { label: 'Marathon', value: formatDuration(props.personalBests.marathon?.elapsedSeconds) },
    { label: 'Longest', countTo: props.longestRunMiles, format: (value) => `${value.toFixed(1)} mi` },
  ]

  return (
    <section className="panel grid grid-cols-2 overflow-hidden rounded-2xl bg-white/[0.035] sm:grid-cols-3 lg:grid-cols-9" aria-label="Journey and running statistics">
      {stats.map((stat) => (
        <div key={stat.label} className="border-b border-r border-white/[0.055] px-3 py-5 text-center last:border-r-0 sm:px-4">
          {'countTo' in stat
            ? <CountUpStat target={stat.countTo} format={stat.format} />
            : <p className="font-mono text-sm font-semibold text-primary sm:text-base">{stat.value}</p>}
          <p className="mt-2 text-[9px] uppercase tracking-[0.22em] text-secondary">{stat.label}</p>
        </div>
      ))}
    </section>
  )
}

function CountUpStat({ target, format }: { target: number; format: (value: number) => string }) {
  const displayed = useCountUp(target)
  return <p className="font-mono text-sm font-semibold text-primary sm:text-base">{format(displayed)}</p>
}
