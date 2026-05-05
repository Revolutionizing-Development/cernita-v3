import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { AppProvider, useApp } from '../lib/context'
import '../styles/globals.css'

// ─── Motion Gate ──────────────────────────────────────────────────────────────
// Reads settings.motionEnabled and applies / removes the `.motion-enabled`
// class on document.body. All animation CSS is gated behind that class so
// toggling this setting reverts every animation instantly.
// Also respects the OS-level prefers-reduced-motion preference.

function MotionGate() {
  const { state } = useApp()
  const enabled = state.settings.motionEnabled

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (enabled && !prefersReduced) {
      document.body.classList.add('motion-enabled')
    } else {
      document.body.classList.remove('motion-enabled')
    }
  }, [enabled])

  return null
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AppProvider>
      <MotionGate />
      <Component {...pageProps} />
    </AppProvider>
  )
}
