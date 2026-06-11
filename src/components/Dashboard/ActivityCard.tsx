import type { DisplayActivity } from '@/lib/activityDisplay'
import { formatDuration, formatPace, formatSportName, sportAccentColor } from '@/lib/activityDisplay'

export default function ActivityCard({ activity, onClick }: { activity: DisplayActivity; onClick: () => void }) {
  const color = sportAccentColor(activity.sportType)
  return (
    <button
      onClick={onClick}
      className="panel group grid w-full gap-3 p-3.5 text-left transition hover:border-neon/30 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon sm:grid-cols-[auto_1fr_auto]"
    >
      <span className="grid h-9 w-9 place-items-center font-mono text-[11px] font-semibold" style={{ color, backgroundColor: `${color}14`, border: `1px solid ${color}50` }}>
        {activity.sportType.slice(0, 2).toUpperCase()}
      </span>
      <span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <strong className="text-sm font-medium text-primary">{formatSportName(activity.sportType)}</strong>
          <span className="font-mono text-[10px] text-secondary">{formatDate(activity.date)}</span>
          {activity.intensity && (
            <span className={`border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] ${intensityColor(activity.intensity)}`}>
              {activity.intensity}
            </span>
          )}
        </span>
        <span className="mt-1 block text-[13px] text-secondary">{activity.summary}</span>
      </span>
      <span className="flex items-center gap-4 font-mono text-xs text-primary sm:justify-end">
        <span>{activity.distanceMiles ? `${activity.distanceMiles.toFixed(1)} mi` : formatDuration(activity.durationSeconds)}</span>
        {activity.averagePaceSecondsPerMile && <span className="text-secondary">{formatPace(activity.averagePaceSecondsPerMile)}</span>}
      </span>
    </button>
  )
}

function intensityColor(intensity: 'easy' | 'moderate' | 'hard'): string {
  if (intensity === 'hard') return 'border-warning/35 text-warning'
  if (intensity === 'moderate') return 'border-glow/35 text-glow'
  return 'border-success/35 text-success'
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    .format(new Date(`${date}T12:00:00`))
}
