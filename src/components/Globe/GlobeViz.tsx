import { useEffect, useMemo, useRef, useState } from 'react'
import { useElementSize } from '@/hooks/useElementSize'
import { getJourneyProgress } from '@/lib/globeRoute'
import {
  createGlobeScene,
  type GlobeBoundary,
  type GlobeScene,
  type MilestoneHover,
} from './globeScene'

interface GlobeVizProps {
  lifetimeMiles: number
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: Array<{
    geometry: GlobeBoundary['geometry'] | null
    properties?: Record<string, unknown>
  }>
}

const COUNTRY_BOUNDARIES_URL = '/data/countries-110m.geojson'
const STATE_BOUNDARIES_URL = '/data/us-states-50m.geojson'

function isFeatureCollection(value: unknown): value is FeatureCollection {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<FeatureCollection>
  return candidate.type === 'FeatureCollection' && Array.isArray(candidate.features)
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function GlobeViz({ lifetimeMiles }: GlobeVizProps) {
  const sceneRef = useRef<GlobeScene | null>(null)
  const canvasHostRef = useRef<HTMLDivElement | null>(null)
  const [boundaries, setBoundaries] = useState<GlobeBoundary[]>([])
  const [hover, setHover] = useState<MilestoneHover | null>(null)
  const [renderFailed, setRenderFailed] = useState(false)
  const { ref: containerRef, width, height } = useElementSize<HTMLDivElement>(520)
  const journey = useMemo(() => getJourneyProgress(lifetimeMiles), [lifetimeMiles])

  useEffect(() => {
    const controller = new AbortController()

    void Promise.all([
      fetch(COUNTRY_BOUNDARIES_URL, { signal: controller.signal }).then((response) => response.ok ? response.json() : null),
      fetch(STATE_BOUNDARIES_URL, { signal: controller.signal }).then((response) => response.ok ? response.json() : null),
    ]).then(([countryData, stateData]: unknown[]) => {
      const next: GlobeBoundary[] = []
      if (isFeatureCollection(countryData)) {
        countryData.features.forEach((feature) => {
          if (feature.geometry) next.push({ geometry: feature.geometry, layer: 'country' })
        })
      }
      if (isFeatureCollection(stateData)) {
        stateData.features.forEach((feature) => {
          if (feature.geometry) next.push({ geometry: feature.geometry, layer: 'state' })
        })
      }
      setBoundaries(next)
    }).catch(() => {
      // The globe remains usable with its grid and route if static boundary data is unavailable.
    })

    return () => controller.abort()
  }, [])

  // The scene is created once per mount; journey and boundary data flow
  // through its setters so React state changes never rebuild the renderer.
  useEffect(() => {
    const host = canvasHostRef.current
    if (!host) return

    let scene: GlobeScene
    try {
      scene = createGlobeScene({
        container: host,
        reducedMotion: prefersReducedMotion(),
        onMilestoneHover: setHover,
      })
    } catch {
      setRenderFailed(true)
      return
    }
    sceneRef.current = scene
    return () => {
      sceneRef.current = null
      setHover(null)
      scene.dispose()
    }
  }, [])

  useEffect(() => {
    if (boundaries.length) sceneRef.current?.setBoundaries(boundaries)
  }, [boundaries])

  useEffect(() => {
    sceneRef.current?.setJourney(journey)
  }, [journey])

  useEffect(() => {
    sceneRef.current?.setSize(width, height)
  }, [width, height])

  const checkpoint = journey.currentSegment?.from ?? journey.completedMilestones.at(-1)

  return (
    <section className="panel relative overflow-hidden bg-[#04080d]">
      <div className="instrument-frame pointer-events-none absolute inset-0 z-[1] opacity-25" />
      <div className="pointer-events-none absolute left-4 top-4 z-10 border border-white/10 bg-[#04080d]/80 px-3 py-2 backdrop-blur-sm">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-secondary">Current checkpoint</p>
        <p className="mt-1 font-mono text-xs text-glow">
          {checkpoint?.city ?? 'Atlanta'}
          {checkpoint?.stateCode ? `, ${checkpoint.stateCode}` : ''}
        </p>
      </div>

      <div
        ref={containerRef}
        data-testid="globe-renderer"
        className="relative h-[55vh] min-h-[470px] w-full sm:h-[60vh] sm:min-h-[540px]"
      >
        <div ref={canvasHostRef} className="absolute inset-0" aria-hidden="true" />
        {renderFailed && (
          <div className="grid h-full place-items-center px-6 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-secondary">
              The interactive globe needs WebGL, which this browser has disabled. Journey progress is
              still summarized below.
            </p>
          </div>
        )}
        {hover && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap border border-glow/25 bg-[#04080d]/92 px-3 py-2 backdrop-blur-sm"
            style={{ left: hover.x, top: hover.y - 14 }}
            role="status"
          >
            <p className="font-mono text-xs text-primary">
              {hover.milestone.city}
              {hover.milestone.stateCode ? `, ${hover.milestone.stateCode}` : ` · ${hover.milestone.country}`}
            </p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-secondary">
              {hover.reached
                ? `Reached · mile ${Math.round(hover.milestone.cumulativeMiles).toLocaleString()}`
                : `Upcoming · mile ${Math.round(hover.milestone.cumulativeMiles).toLocaleString()}`}
            </p>
          </div>
        )}
      </div>

      <div className="relative z-10 grid gap-px border-t border-white/[0.08] bg-white/[0.08] sm:absolute sm:bottom-4 sm:left-4 sm:right-4 sm:grid-cols-2 sm:gap-2 sm:border-0 sm:bg-transparent lg:grid-cols-4">
        <Metric label="States reached" value={`${journey.completedStates.length} / 50`} />
        <Metric label="Journey" value={`${(journey.progress * 100).toFixed(1)}%`} />
        <Metric
          label={journey.stage === 'united-states' ? 'U.S. stage' : 'Global stage'}
          value={`${(journey.stageProgress * 100).toFixed(1)}%`}
        />
        <Metric
          label={journey.completed ? 'Journey complete' : 'Next milestone'}
          value={journey.completed
            ? `+${journey.excessMiles.toFixed(0)} excess mi`
            : `${journey.nextMilestone?.city ?? '—'} · ${journey.milesUntilNext.toFixed(0)} mi`}
        />
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#070d14] px-5 py-3.5 backdrop-blur-md sm:border sm:border-white/10 sm:bg-[#070d14]/88 sm:px-4 sm:py-2.5">
      <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-secondary">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-medium text-primary">{value}</p>
    </div>
  )
}
