import type { StravaStream } from '@/schemas/strava'
import type { MetricPoint } from '@/components/Charts/MetricChart'

export interface ActivityChartSeries {
  pace: MetricPoint[]
  heartRate: MetricPoint[]
  cadence: MetricPoint[]
  power: MetricPoint[]
}

function downsample(values: readonly (number | null)[], maximumPoints = 240): MetricPoint[] {
  if (values.length <= maximumPoints) return values.map((value, index) => ({ index, value }))
  const bucketSize = values.length / maximumPoints
  return Array.from({ length: maximumPoints }, (_, index) => {
    const start = Math.floor(index * bucketSize)
    const end = Math.max(start + 1, Math.floor((index + 1) * bucketSize))
    const bucket = values.slice(start, end).flatMap((value) => value === null ? [] : [value])
    return {
      index,
      value: bucket.length ? bucket.reduce((sum, value) => sum + value, 0) / bucket.length : null,
    }
  })
}

function values(stream: StravaStream | undefined): number[] {
  return stream?.data ?? []
}

export function createActivityChartSeries(streams: Record<string, StravaStream>): ActivityChartSeries {
  const velocity = values(streams.velocity_smooth)
  const pace = velocity.map((metersPerSecond) => metersPerSecond > 0 ? 1609.344 / metersPerSecond : null)
  const cadence = values(streams.cadence).map((value) => value > 0 && value < 120 ? value * 2 : value)
  return {
    pace: downsample(pace),
    heartRate: downsample(values(streams.heartrate)),
    cadence: downsample(cadence),
    power: downsample(values(streams.watts)),
  }
}
