import { z } from 'zod'

export const weatherDataSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  current: z.object({
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    precipitation_probability: z.number(),
    weather_code: z.number().int(),
    uv_index: z.number(),
    wind_speed_10m: z.number(),
  }),
})

export type WeatherData = z.infer<typeof weatherDataSchema>
