import { useEffect, useState } from 'react'
import type { WeatherData } from '@/schemas/weather'
import { fetchRunningWeather, runningConditions, weatherCondition } from '@/lib/weather'

// Public visitors see this fixed sample so the widget is demonstrable without
// requesting geolocation or calling the forecast API. Live data is owner-only.
const SAMPLE_CONDITIONS: WeatherData['current'] = {
  temperature_2m: 63,
  apparent_temperature: 61,
  relative_humidity_2m: 52,
  precipitation_probability: 10,
  weather_code: 1,
  uv_index: 4.2,
  wind_speed_10m: 6,
}

export default function WeatherWidget({ enabled = true }: { enabled?: boolean }) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetchRunningWeather()
      .then((data) => { if (!cancelled) setWeather(data) })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Weather unavailable.')
      })
    return () => { cancelled = true }
  }, [enabled])

  if (error) {
    return (
      <section className="panel p-6">
        <p className="instrument-label">Local conditions</p>
        <p className="mt-4 text-sm leading-relaxed text-secondary">Weather hidden. {error}</p>
      </section>
    )
  }
  if (enabled && !weather) {
    return <section className="panel min-h-48 animate-pulse" aria-label="Loading local weather" />
  }

  const current = weather?.current ?? SAMPLE_CONDITIONS
  const conditions = runningConditions(current)
  const verdictColor = conditions.level === 'good' ? 'text-success' : conditions.level === 'poor' ? 'text-warning' : 'text-glow'
  return (
    <section className="panel p-6">
      <p className="instrument-label">Local conditions</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-4">
          <WeatherIcon code={current.weather_code} />
          <div>
            <p className="font-mono text-4xl text-primary">{Math.round(current.apparent_temperature)}°</p>
            <p className="mt-1 text-xs text-secondary">Feels like · {weatherCondition(current.weather_code)}</p>
          </div>
        </div>
        <div className="text-right font-mono text-xs text-secondary">
          <p>{Math.round(current.precipitation_probability)}% rain</p>
          <p className="mt-1">UV {current.uv_index.toFixed(1)}</p>
          <p className="mt-1">{Math.round(current.wind_speed_10m)} mph wind</p>
        </div>
      </div>
      <p className={`mt-5 border-t border-white/5 pt-4 text-sm leading-relaxed ${verdictColor}`}>
        {conditions.verdict}
      </p>
    </section>
  )
}

function WeatherIcon({ code }: { code: number }) {
  const rainy = code >= 51 && code <= 82
  const snowy = code >= 71 && code <= 77
  const stormy = code > 82
  const cloudy = code > 0 && code <= 48
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-12 w-12 shrink-0 text-glow" fill="none" stroke="currentColor" strokeWidth="2">
      {code === 0 ? (
        <>
          <circle cx="24" cy="24" r="8" />
          <path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.5 10.5l4.2 4.2M33.3 33.3l4.2 4.2M37.5 10.5l-4.2 4.2M14.7 33.3l-4.2 4.2" />
        </>
      ) : (
        <>
          <path d="M13 31h23a7 7 0 0 0 .5-14 12 12 0 0 0-22.7 2.5A6 6 0 0 0 13 31Z" />
          {cloudy && <path d="M17 12a9 9 0 0 1 15-2" opacity=".55" />}
          {rainy && !snowy && <path d="m17 36-2 5m10-5-2 5m10-5-2 5" />}
          {snowy && <path d="M16 38h2m6 0h2m6 0h2" strokeLinecap="round" />}
          {stormy && <path d="m27 33-5 7h5l-3 5" />}
        </>
      )}
    </svg>
  )
}

