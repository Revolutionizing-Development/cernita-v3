import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o password non validi · Invalid email or password.')
      setLoading(false)
    } else {
      router.replace('/')
    }
  }

  return (
    <>
      <Head>
        <title>Cernita — Accedi</title>
      </Head>
      <div className="login-shell">
        <div className="login-ornament">✦</div>
        <h1 className="login-logo">Cernita</h1>
        <p className="login-tagline">La cernita — the sorting.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <label className="input-label" htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="input-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Accesso in corso…' : 'Accedi · Sign in'}
          </button>
        </form>
      </div>
    </>
  )
}
