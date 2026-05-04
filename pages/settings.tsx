import Head from 'next/head'
import { useRouter } from 'next/router'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import { useApp } from '../lib/context'
import { supabase } from '../lib/supabase'

export default function SettingsPage() {
  const { state, dispatch } = useApp()
  const router = useRouter()
  const { user, settings } = state

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function updateSetting<K extends keyof typeof settings>(key: K, value: typeof settings[K]) {
    dispatch({ type: 'SET_SETTINGS', settings: { ...settings, [key]: value } })
  }

  const displayName = user?.user_metadata?.display_name ?? user?.email ?? 'User'

  return (
    <AuthGuard>
      <Head><title>Cernita — Settings</title></Head>
      <div className="app-shell">
        <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--paper-dark)' }}>
          <span className="serif" style={{ fontSize: '20px' }}>Settings</span>
        </header>

        <div className="page-content">
          {/* Identity */}
          <div className="card" style={{ marginBottom: 24 }}>
            <p style={{ fontWeight: 600 }}>{displayName}</p>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12 }}>{user?.email}</p>
            <button className="btn-destructive" onClick={handleSignOut}>
              Esci · Sign out
            </button>
          </div>

          {/* Rates */}
          <h2 className="section-header">Rates &amp; assumptions · <span className="italic ink-soft">Tariffe e ipotesi</span></h2>

          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="input-label">Storage rate ($/cu ft/month)</label>
                <input
                  type="number"
                  className="input"
                  step="0.01"
                  value={settings.storageRatePerCuFt}
                  onChange={e => updateSetting('storageRatePerCuFt', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="input-label">Ocean shipping — $/lb</label>
                <input
                  type="number"
                  className="input"
                  step="0.01"
                  value={settings.shippingRatePerLb}
                  onChange={e => updateSetting('shippingRatePerLb', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="input-label">Ocean shipping — $/cu ft</label>
                <input
                  type="number"
                  className="input"
                  step="0.01"
                  value={settings.shippingRatePerCuFt}
                  onChange={e => updateSetting('shippingRatePerCuFt', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="input-label">Months in storage</label>
                <input
                  type="number"
                  className="input"
                  step="1"
                  value={settings.monthsInStorage}
                  onChange={e => updateSetting('monthsInStorage', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* AI Model */}
          <h2 className="section-header" style={{ marginTop: 24 }}>AI model · <span className="italic ink-soft">Modello AI</span></h2>
          <div className="card">
            <select
              className="input"
              value={settings.aiModel}
              onChange={e => updateSetting('aiModel', e.target.value)}
            >
              <option value="claude-sonnet-4-5">Claude Sonnet — Balanced (recommended)</option>
              <option value="claude-opus-4-5">Claude Opus — Most thorough (slower)</option>
              <option value="claude-haiku-4-5">Claude Haiku — Fastest</option>
            </select>
          </div>

          {/* Maintenance */}
          <h2 className="section-header" style={{ marginTop: 24 }}>Maintenance · <span className="italic ink-soft">Manutenzione</span></h2>
          <div className="card" style={{ background: 'var(--paper-dark)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn-secondary">
                Export CSV · <span className="italic">Esporta CSV</span>
              </button>
              <button className="btn-secondary">
                Re-derive outdated entries · <span className="italic">Rideriva voci obsolete</span>
              </button>
            </div>
          </div>
        </div>

        <Nav />
      </div>
    </AuthGuard>
  )
}
