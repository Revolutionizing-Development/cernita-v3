import Head from 'next/head'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'

export default function DiscussPage() {
  return (
    <AuthGuard>
      <Head><title>Cernita — Discuss</title></Head>
      <div className="app-shell">
        <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--paper-dark)' }}>
          <span className="serif" style={{ fontSize: '20px' }}>Discuss</span>
        </header>
        <div className="page-content">
          <div className="empty-state">
            <h3>No disagreements yet</h3>
            <p className="italic ink-soft">Nessun disaccordo ancora.</p>
          </div>
        </div>
        <Nav />
      </div>
    </AuthGuard>
  )
}
