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
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', gap: 12 }}>
        <span className="serif" style={{ fontSize: '32px', color: 'var(--ink-soft)' }}>Cernita</span>
        <span style={{ fontSize: '13px', color: 'var(--ink-soft)', fontStyle: 'italic' }}>Connecting… · Connessione…</span>
      </div>
    )
  }

  // Confirmed: no session — redirect to login (useEffect handles redirect)
  if (state.session === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', gap: 12 }}>
        <span className="serif" style={{ fontSize: '32px', color: 'var(--ink-soft)' }}>Cernita</span>
        <span style={{ fontSize: '13px', color: 'var(--ink-soft)', fontStyle: 'italic' }}>Redirecting… · Reindirizzamento…</span>
      </div>
    )
  }

  return <>{children}</>
}
