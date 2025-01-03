import Lenis from 'lenis'
import { useEffect, useRef } from 'react'

export function useLenis() {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    // Initialize Lenis
    lenisRef.current = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    })

    // Stop Lenis when the page is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        lenisRef.current?.stop()
      } else {
        lenisRef.current?.start()
      }
    })

    // Set up RAF loop
    function raf(time: number) {
      lenisRef.current?.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    // Cleanup
    return () => {
      lenisRef.current?.destroy()
      lenisRef.current = null
    }
  }, [])

  return lenisRef.current
}
