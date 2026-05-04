import Head from 'next/head'
import { useState } from 'react'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import SyncIndicator from '../components/SyncIndicator'

export default function EvaluatePage() {
  const [mode, setMode] = useState<'camera' | 'text'>('camera')
  const [description, setDescription] = useState('')

  return (
    <AuthGuard>
      <Head><title>Cernita — Evaluate</title></Head>
      <div className="app-shell">
        <header style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--paper-dark)' }}>
          <span className="serif" style={{ fontSize: '20px' }}>Evaluate</span>
          <SyncIndicator />
        </header>

        <div className="page-content">
          {mode === 'camera' ? (
            <div style={{ textAlign: 'center', paddingTop: 32 }}>
              <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--paper-dark)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <span style={{ color: 'var(--ink-soft)', fontSize: 48 }}>◎</span>
              </div>
              <button className="btn-primary" style={{ marginBottom: 12 }}>
                Evaluate
              </button>
              <button
                className="btn-secondary"
                onClick={() => setMode('text')}
                style={{ width: '100%' }}
              >
                Describe instead
              </button>
            </div>
          ) : (
            <div>
              <label className="input-label">Describe the item</label>
              <textarea
                className="input"
                style={{ minHeight: 120, resize: 'vertical' }}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Cast iron 12-inch skillet, Lodge brand, good condition…"
              />
              <button className="btn-primary" style={{ marginTop: 12 }}>
                Evaluate
              </button>
              <button
                className="btn-secondary"
                onClick={() => setMode('camera')}
                style={{ width: '100%', marginTop: 8 }}
              >
                Use camera instead
              </button>
            </div>
          )}
        </div>

        <Nav />
      </div>
    </AuthGuard>
  )
}
