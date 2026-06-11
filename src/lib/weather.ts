import { weatherDataSchema, type WeatherData } from '@/schemas/weather'

const CACHE_KEY = 'runaround_weather_cache'
const CACHE_DURATION_MS = 30 * 60 * 1000

interface WeatherCache {
  fetchedAt: number
  latitude: number
  longitude: number
  data: WeatherData
}

export interface RunningConditions {
  verdict: string
  level: 'good' | 'caution' | 'poor'
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: CACHE_DURATION_MS,
    })
  })
}

function readCache(latitude: number, longitude: number): WeatherData | null {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Partial<WeatherCache> | null
    if (!cache?.data || !cache.fetchedAt) return null
    const nearby = Math.abs((cache.latitude ?? 999) - latitude) < 0.1
      && Math.abs((cache.longitude ?? 999) - longitude) < 0.1
    if (!nearby || Date.now() - cache.fetchedAt >= CACHE_DURATION_MS) return null
    return weatherDataSchema.parse(cache.data)
  } catch {
    localStorage.removeItem(CACHE_KEY)
    return null
  }
}

export async function fetchRunningWeather(): Promise<WeatherData> {
  const position = await currentPosition()
  const { latitude, longitude } = position.coords
  const cached = readCache(latitude, longitude)
  if (cached) return cached

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: [
      'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
      'precipitation_probability', 'weather_code', 'uv_index', 'wind_speed_10m',
    ].join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
  }).toString()
  const response = await fetch(url)
  if (!response.ok) throw new Error('Weather service is unavailable.')
  const data = weatherDataSchema.parse(await response.json())
  const cache: WeatherCache = { fetchedAt: Date.now(), latitude, longitude, data }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  return data
}

export function runningConditions(weather: WeatherData['current']): RunningConditions {
  if (weather.precipitation_probability > 60) {
    return { level: 'poor', verdict: 'Rain likely — consider a treadmill or waterproof gear.' }
  }
  if (weather.apparent_temperature > 85 && weather.relative_humidity_2m > 60) {
    return { level: 'poor', verdict: 'Hot and humid — start early and reduce effort.' }
  }
  if (weather.apparent_temperature > 85) {
    return { level: 'caution', verdict: 'Hot — start early, hydrate, and reduce effort.' }
  }
  if (weather.apparent_temperature < 35) {
    return { level: 'caution', verdict: 'Cold — layer up and extend the warmup.' }
  }
  if (weather.wind_speed_10m > 20) {
    return { level: 'caution', verdict: 'Strong wind — choose a sheltered route and run by effort.' }
  }
  if (weather.uv_index > 8) {
    return { level: 'caution', verdict: 'High UV — use sunscreen and avoid peak sun.' }
  }
  return { level: 'good', verdict: 'Good conditions for a run.' }
}

export function weatherCondition(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Cloudy'
  if (code <= 48) return 'Foggy'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  return 'Storms'
}
