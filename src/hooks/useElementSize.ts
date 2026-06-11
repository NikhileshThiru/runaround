import { useEffect, useRef, useState } from 'react'

interface ElementSize {
  width: number
  height: number
}

export function useElementSize<T extends HTMLElement>(minimumHeight = 480) {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: minimumHeight })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      const bounds = element.getBoundingClientRect()
      setSize({ width: Math.max(1, bounds.width), height: Math.max(minimumHeight, bounds.height) })
    }
    update()
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update)
      observer.observe(element)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [minimumHeight])

  return { ref, ...size }
}
