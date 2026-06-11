import type { PublicSnapshot } from '@/schemas/publicSnapshot'

interface TelemetryStripProps {
  trends: PublicSnapshot['trends']
}

function formatPace(secondsPerMile: number): string {
  const total = Math.round(secondsPerMile)
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}/mi`
}

/**
 * Compact mission-control readout of the latest training state. Every value
 * is derived from the same trend series the charts render, so the strip never
 * disagrees with the detail views below it.
 */
export default function TelemetryStrip({ trends }: TelemetryStripProps) {
  const latestLoad = trends.load.at(-1)
  const lastWeek = trends.weeklyMileage.at(-1)
  const latestRun = [...trends.running].reverse().find((point) => point.paceSecondsPerMile !== null)

  const readouts: { label: string; value: string; tone?: 'good' | 'warn' }[] = [
    { label: 'CTL · 42d', value: latestLoad ? latestLoad.ctl.toFixed(1) : '—' },
    { label: 'ATL · 7d', value: latestLoad ? latestLoad.atl.toFixed(1) : '—' },
    {
      label: 'Form',
      value: latestLoad ? `${latestLoad.form > 0 ? '+' : ''}${latestLoad.form.toFixed(1)}` : '—',
      tone: latestLoad ? (latestLoad.form >= 0 ? 'good' : 'warn') : undefined,
    },
    { label: 'Last wk', value: lastWeek ? `${lastWeek.miles.toFixed(1)} mi` : '—' },
    { label: 'Baseline', value: lastWeek?.baseline != null ? `${lastWeek.baseline.toFixed(1)} mi` : '—' },
    { label: 'Last pace', value: latestRun?.paceSecondsPerMile ? formatPace(latestRun.paceSecondsPerMile) : '—' },
  ]

  return (
    <section className="panel grid grid-cols-3 overflow-hidden bg-white/[0.02] sm:grid-cols-6" aria-label="Latest training telemetry">
      {readouts.map((readout) => (
        <div key={readout.label} className="border-r border-white/[0.05] px-3 py-2.5 last:border-r-0 sm:px-4">
          <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-secondary">{readout.label}</p>
          <p className={`mt-1 font-mono text-sm font-medium ${
            readout.tone === 'good' ? 'text-success' : readout.tone === 'warn' ? 'text-warning' : 'text-primary'
          }`}>
            {readout.value}
          </p>
        </div>
      ))}
    </section>
  )
}
