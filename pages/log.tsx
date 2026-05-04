import Head from 'next/head'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import SyncIndicator from '../components/SyncIndicator'
import { useApp } from '../lib/context'
import { DECISION_LABELS, DECISION_BADGE_CLASS, Decision } from '../lib/types'

export default function LogPage() {
  const { state } = useApp()
  const entries = state.log

  return (
    <AuthGuard>
      <Head><title>Cernita — Log</title></Head>
      <div className="app-shell">
        <header style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--paper-dark)' }}>
          <span className="serif" style={{ fontSize: '20px' }}>Log</span>
          <SyncIndicator />
        </header>

        <div className="page-content">
          {entries.length === 0 ? (
            <div className="empty-state">
              <h3>No items yet</h3>
              <p className="italic ink-soft">Nessun oggetto valutato ancora.</p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 16 }}>
                {entries.length} item{entries.length !== 1 ? 's' : ''} evaluated
              </p>
              {entries.map(entry => (
                <div key={entry.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 4, background: entry.photo_data ? 'transparent' : 'var(--paper-dark)', flexShrink: 0, overflow: 'hidden' }}>
                    {entry.photo_data && (
                      <img src={entry.photo_data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.item_name}</div>
                        {entry.item_name_it && (
                          <div className="italic ink-soft" style={{ fontSize: 12 }}>{entry.item_name_it}</div>
                        )}
                      </div>
                      <span className={DECISION_BADGE_CLASS[entry.final_decision as Decision]}>
                        {entry.final_decision}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
                      {entry.user_name} · {new Date(entry.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Nav />
      </div>
    </AuthGuard>
  )
}
