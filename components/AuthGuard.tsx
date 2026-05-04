import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useApp } from '../lib/context'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { state } = useApp()
  const router = useRouter()

  useEffect(() => {
    // Wait for auth state to initialize (session will be null on first render)
    // Supabase's onAuthStateChange fires quickly; we add a small guard
    const timer = setTimeout(() => {
      if (state.session === null) {
        router.replace('/login')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [state.session, router])

  if (state.session === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
        <span className="serif" style={{ fontSize: '32px', color: 'var(--ink-soft)' }}>Cernita</span>
      </div>
    )
  }

  return <>{children}</>
}
