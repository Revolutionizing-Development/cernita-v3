import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useApp } from '../lib/context'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { state } = useApp()
  const router = useRouter()

  useEffect(() => {
    // Only redirect once we are certain there is no session.
    // authLoading is true until onAuthStateChange fires for the first time —
    // which guarantees we never redirect during the async session-restore window.
    if (!state.authLoading && state.session === null) {
      router.replace('/login')
    }
  }, [state.authLoading, state.session, router])

  // Still waiting for Supabase to confirm whether a session exists
  if (state.authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
        <span className="serif" style={{ fontSize: '32px', color: 'var(--ink-soft)' }}>Cernita</span>
      </div>
    )
  }

  // Confirmed: no session
  if (state.session === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
        <span className="serif" style={{ fontSize: '32px', color: 'var(--ink-soft)' }}>Cernita</span>
      </div>
    )
  }

  return <>{children}</>
}
