import { useEffect, useRef, useState } from 'react'

const COUNT_UP_DURATION_MS = 1100

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Animates from the previously displayed value to the target value with an
 * ease-out curve. Users who prefer reduced motion always receive the final
 * value immediately.
 */
export function useCountUp(target: number): number {
  const [displayed, setDisplayed] = useState(() => prefersReducedMotion() ? target : 0)
  const displayedRef = useRef(displayed)
  displayedRef.current = displayed

  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(target)) {
      setDisplayed(target)
      return
    }
    const from = displayedRef.current
    if (from === target) return

    let frame = 0
    let start: number | null = null
    const step = (now: number) => {
      start ??= now
      const t = Math.min((now - start) / COUNT_UP_DURATION_MS, 1)
      const eased = 1 - (1 - t) ** 3
      setDisplayed(from + (target - from) * eased)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target])

  return displayed
}
