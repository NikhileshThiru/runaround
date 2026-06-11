import type { DisplayActivity } from '@/lib/activityDisplay'
import ActivityCard from './ActivityCard'

export default function ActivityFeed({ activities, onSelect }: {
  activities: readonly DisplayActivity[]
  onSelect: (activity: DisplayActivity) => void
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="console-label"><b>D</b> Movement log</p>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-primary">Recent activities</h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-secondary">{activities.length} shown</span>
      </div>
      {activities.length ? (
        <div className="space-y-2">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} onClick={() => onSelect(activity)} />
          ))}
        </div>
      ) : (
        <div className="panel border-dashed bg-surface/40 px-6 py-14 text-center">
          <p className="font-display text-sm uppercase tracking-[0.14em] text-primary">No published activities</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-secondary">The public feed stays empty until the owner publishes a sanitized snapshot. Private Strava data is never loaded for visitors.</p>
        </div>
      )}
    </section>
  )
}
