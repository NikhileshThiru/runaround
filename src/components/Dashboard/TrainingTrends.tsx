import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReactNode } from 'react'
import type { PublicSnapshot } from '@/schemas/publicSnapshot'

interface TrainingTrendsProps {
  trends: PublicSnapshot['trends']
}

const tooltipStyle = {
  background: '#0b0d13',
  border: '1px solid rgba(192,132,252,.28)',
  borderRadius: '8px',
  color: '#f4f3f7',
}

export default function TrainingTrends({ trends }: TrainingTrendsProps) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Trend analysis</p>
          <h2 className="mt-2 font-display text-2xl text-primary">Training telemetry</h2>
        </div>
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-secondary sm:block">Rolling windows · observed data</span>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
      <ChartCard
        title="Weekly mileage"
        description="Baseline is the median mileage from up to the last six completed weeks. It describes your recent normal volume; it is not a prescribed target."
        summary={mileageSummary(trends.weeklyMileage)}
        hasData={trends.weeklyMileage.length > 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trends.weeklyMileage} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="mileageGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
            <XAxis dataKey="weekStart" tick={{ fill: '#888899', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#888899', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="miles" name="Mileage" stroke="#c084fc" fill="url(#mileageGlow)" strokeWidth={2} />
            <Line type="monotone" dataKey="baseline" name="Baseline" stroke="#72d4aa" strokeDasharray="5 5" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Training load & form"
        description="CTL is the 42-day long-term load trend. ATL is the faster 7-day fatigue trend. Form equals CTL minus ATL: positive generally means fresher; negative means more accumulated fatigue."
        summary={loadSummary(trends.load)}
        hasData={trends.load.length > 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trends.load} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#888899', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={{ fill: '#888899', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="ctl" name="CTL" stroke="#c084fc" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="atl" name="ATL" stroke="#f0a868" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="form" name="Form" stroke="#72d4aa" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Running pace & heart rate" summary={runningSummary(trends.running)} hasData={trends.running.length > 0}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trends.running} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#888899', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis yAxisId="pace" reversed tickFormatter={formatPaceTick} tick={{ fill: '#888899', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="hr" orientation="right" tick={{ fill: '#888899', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={formatRunningTooltip} />
            <Line yAxisId="pace" type="monotone" dataKey="paceSecondsPerMile" name="Pace" stroke="#c084fc" dot={{ r: 2 }} strokeWidth={2} connectNulls={false} />
            <Line yAxisId="hr" type="monotone" dataKey="averageHeartRate" name="Heart rate" stroke="#de7898" dot={{ r: 2 }} strokeWidth={1.5} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Normalized running cadence" summary={cadenceSummary(trends.running)} hasData={trends.running.some((point) => point.cadence !== null)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trends.running} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#888899', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis domain={['dataMin - 4', 'dataMax + 4']} tick={{ fill: '#888899', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(0)} spm`, 'Cadence']} />
            <Line type="monotone" dataKey="cadence" name="Cadence" stroke="#72d4aa" dot={{ r: 2 }} strokeWidth={2} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      </div>
    </section>
  )
}

function ChartCard({ title, description, summary, hasData, children }: {
  title: string
  description?: string
  summary: string
  hasData: boolean
  children: ReactNode
}) {
  return (
    <div className="panel p-5">
      <h3 className="font-display text-sm uppercase tracking-[0.16em] text-primary">{title}</h3>
      {description && <p className="mt-2 max-w-2xl text-xs leading-relaxed text-secondary">{description}</p>}
      <p className={hasData ? 'sr-only' : 'mt-4 text-sm leading-relaxed text-secondary'}>{summary}</p>
      {hasData && <div className="mt-5 h-64">{children}</div>}
    </div>
  )
}

function mileageSummary(points: TrainingTrendsProps['trends']['weeklyMileage']): string {
  if (!points.length) return 'No weekly mileage data is available.'
  return points.map((point) => `${point.weekStart}: ${point.miles} miles`).join('; ')
}

function loadSummary(points: TrainingTrendsProps['trends']['load']): string {
  if (!points.length) return 'No training load data is available.'
  const latest = points.at(-1)!
  return `Latest CTL ${latest.ctl}, ATL ${latest.atl}, and form ${latest.form}.`
}

function formatPaceTick(value: number): string {
  const total = Math.round(value)
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`
}

function formatRunningTooltip(value: unknown, name: unknown): [string, string] {
  const numeric = Number(value)
  const label = String(name)
  return label === 'Pace'
    ? [`${formatPaceTick(numeric)}/mi`, label]
    : [`${numeric.toFixed(0)} bpm`, label]
}

function runningSummary(points: TrainingTrendsProps['trends']['running']): string {
  if (!points.length) return 'No running pace or heart-rate observations are available for the last 30 days.'
  return points.map((point) => {
    const pace = point.paceSecondsPerMile === null ? 'pace unavailable' : `${formatPaceTick(point.paceSecondsPerMile)} per mile`
    const heartRate = point.averageHeartRate === null ? 'heart rate unavailable' : `${point.averageHeartRate} beats per minute`
    return `${point.date}: ${pace}, ${heartRate}`
  }).join('; ')
}

function cadenceSummary(points: TrainingTrendsProps['trends']['running']): string {
  const available = points.filter((point) => point.cadence !== null)
  if (!available.length) return 'No normalized running cadence observations are available for the last 30 days.'
  return available.map((point) => `${point.date}: ${point.cadence} steps per minute`).join('; ')
}
