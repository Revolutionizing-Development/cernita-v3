import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from its previous value to `target` over `duration` ms.
 * Uses ease-out cubic easing via requestAnimationFrame.
 * Returns the current animated value.
 */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0)
  const prev = useRef(0)

  useEffect(() => {
    const start = prev.current
    const delta = target - start
    if (delta === 0) return

    const startTime = performance.now()
    let raf: number

    function step(now: number) {
      const t = Math.min((now - startTime) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(start + delta * eased))
      if (t < 1) raf = requestAnimationFrame(step)
      else prev.current = target
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
