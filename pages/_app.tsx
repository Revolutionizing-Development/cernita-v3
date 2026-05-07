import type { AppProps } from 'next/app'
import { useEffect, useState } from 'react'
import { AppProvider, useApp } from '../lib/context'
import Walkthrough from '../components/Walkthrough'
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

// ─── Onboarding Gate ─────────────────────────────────────────────────────────
// Shows the walkthrough on first login (AC30). Tracked via localStorage flag.
// Does not show until the user is authenticated (avoids flash on login page).

const ONBOARDING_KEY = 'cernita_hasSeenOnboarding'

function OnboardingGate() {
  const { state } = useApp()
  const [showWalkthrough, setShowWalkthrough] = useState(false)

  useEffect(() => {
    // Only check once the user is logged in
    if (!state.user) return
    const seen = localStorage.getItem(ONBOARDING_KEY) === 'true'
    if (!seen) {
      setShowWalkthrough(true)
    }
  }, [state.user])

  function handleComplete() {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setShowWalkthrough(false)
  }

  if (!showWalkthrough) return null

  return <Walkthrough onComplete={handleComplete} />
}

// Exported for Settings "Replay walkthrough" button
export function replayWalkthrough() {
  localStorage.removeItem(ONBOARDING_KEY)
  // Force page reload to re-trigger the onboarding gate
  window.location.reload()
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AppProvider>
      <MotionGate />
      <OnboardingGate />
      <Component {...pageProps} />
    </AppProvider>
  )
}
