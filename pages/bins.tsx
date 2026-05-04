import Head from 'next/head'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'

export default function BinsPage() {
  return (
    <AuthGuard>
      <Head><title>Cernita — Bins</title></Head>
      <div className="app-shell">
        <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--paper-dark)' }}>
          <span className="serif" style={{ fontSize: '20px' }}>Bins</span>
        </header>
        <div className="page-content">
          <div className="empty-state">
            <h3>Coming soon</h3>
            <p className="italic ink-soft">Location tracking — Spec 006</p>
          </div>
        </div>
        <Nav />
      </div>
    </AuthGuard>
  )
}
