import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface MetricPoint {
  index: number
  value: number | null
}

export default function MetricChart({
  title,
  points,
  color,
  unit,
  formatter,
  reversedY = false,
}: {
  title: string
  points: readonly MetricPoint[]
  color: string
  unit: string
  formatter?: (value: number) => string
  /** Reverse the Y axis for metrics where a lower number is better (pace). */
  reversedY?: boolean
}) {
  if (!points.some((point) => point.value !== null)) return null
  return (
    <section className="panel p-4">
      <h3 className="font-display text-xs uppercase tracking-[0.16em] text-primary">{title}</h3>
      <div className="mt-4 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
            <XAxis dataKey="index" hide />
            <YAxis reversed={reversedY} tick={{ fill: '#888899', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(value) => {
                const numeric = Number(value)
                return [formatter ? formatter(numeric) : `${numeric.toFixed(0)} ${unit}`, title]
              }}
              labelFormatter={(index) => `Sample ${Number(index) + 1}`}
              contentStyle={{ background: '#0b0d13', border: '1px solid rgba(192,132,252,.28)', borderRadius: 8 }}
            />
            <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={1.8} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">{accessibleSummary(title, points, unit, formatter)}</p>
    </section>
  )
}

function accessibleSummary(
  title: string,
  points: readonly MetricPoint[],
  unit: string,
  formatter?: (value: number) => string,
): string {
  const values = points.flatMap((point) => point.value === null ? [] : [point.value])
  if (!values.length) return `${title} is unavailable.`
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const format = formatter ?? ((value: number) => `${value.toFixed(0)} ${unit}`)
  return `${title}: average ${format(average)}, minimum ${format(minimum)}, maximum ${format(maximum)}.`
}
