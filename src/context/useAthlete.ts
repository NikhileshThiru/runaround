import { useContext } from 'react'
import { AthleteContext, type AthleteContextValue } from './athleteContextValue'

export function useAthlete(): AthleteContextValue {
  const context = useContext(AthleteContext)
  if (!context) throw new Error('useAthlete must be used within AthleteProvider.')
  return context
}
