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

  // Bump rulesVersion whenever a rate changes so the outdated-badge logic fires
  function updateRate<K extends keyof typeof settings>(key: K, value: typeof settings[K]) {
    const [major, minor, patch] = settings.rulesVersion.split('.').map(Number)
    const nextVersion = `${major}.${minor}.${patch + 1}`
    dispatch({
      type: 'SET_SETTINGS',
      settings: { ...settings, [key]: value, rulesVersion: nextVersion },
    })
  }

  const displayName = user?.user_metadata?.display_name ?? user?.email ?? 'User'

  return (
    <AuthGuard>
      <Head><title>Cernita — Settings</title></Head>
      <div className="app-shell">
        <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--paper-dark)' }}>
          <span className="serif" style={{ fontSize: '20px' }}>Settings · <em className="ink-soft" style={{ fontStyle: 'italic' }}>Impostazioni</em></span>
        </header>

        <div className="page-content">

          {/* ── Identity ── */}
          <div className="card" style={{ marginBottom: 24 }}>
            <p style={{ fontWeight: 600, marginBottom: 2 }}>{displayName}</p>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 14 }}>{user?.email}</p>
            <button className="btn-destructive" onClick={handleSignOut}>
              Esci · Sign out
            </button>
          </div>

          {/* ── Move route ── */}
          <h2 className="section-header">
            Move route · <em className="italic ink-soft">Percorso</em>
          </h2>
          <div className="card" style={{ marginBottom: 24 }}>
            <p className="settings-hint">
              Illinois → <strong>{settings.usDestination}</strong> → Italy
              <br />
              <em className="ink-soft" style={{ fontSize: 12 }}>
                Items marked "Keep — US stop" will stay here before or instead of going to Italy.
              </em>
            </p>
            <div style={{ marginTop: 14 }}>
              <label className="input-label">US intermediate city · Città di sosta USA</label>
              <input
                type="text"
                className="input"
                value={settings.usDestination}
                onChange={e => updateSetting('usDestination', e.target.value)}
                placeholder="e.g. Colorado Springs"
              />
            </div>
          </div>

          {/* ── Rates ── */}
          <h2 className="section-header">
            Rates · <em className="italic ink-soft">Tariffe</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Changing a rate bumps the rules version (v{settings.rulesVersion}) and marks
            older entries as outdated in the Log.
          </p>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="input-label">Storage rate ($/cu ft / month)</label>
                <input
                  type="number"
                  className="input"
                  step="0.01"
                  min="0"
                  value={settings.storageRatePerCuFt}
                  onChange={e => updateRate('storageRatePerCuFt', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="input-label">Months in storage · Mesi in deposito</label>
                <input
                  type="number"
                  className="input"
                  step="1"
                  min="1"
                  value={settings.monthsInStorage}
                  onChange={e => updateRate('monthsInStorage', parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <label className="input-label">Ocean shipping — $/lb</label>
                <input
                  type="number"
                  className="input"
                  step="0.01"
                  min="0"
                  value={settings.shippingRatePerLb}
                  onChange={e => updateRate('shippingRatePerLb', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="input-label">Ocean shipping — $/cu ft</label>
                <input
                  type="number"
                  className="input"
                  step="0.01"
                  min="0"
                  value={settings.shippingRatePerCuFt}
                  onChange={e => updateRate('shippingRatePerCuFt', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* ── AI model ── */}
          <h2 className="section-header">
            AI model · <em className="italic ink-soft">Modello AI</em>
          </h2>
          <div className="card" style={{ marginBottom: 24 }}>
            <select
              className="input"
              value={settings.aiModel}
              onChange={e => updateSetting('aiModel', e.target.value)}
            >
              <option value="claude-sonnet-4-5">Claude Sonnet 4.5 — Balanced (recommended)</option>
              <option value="claude-opus-4-5">Claude Opus 4.5 — Most thorough (slower)</option>
              <option value="claude-haiku-3-5-20241022">Claude Haiku 3.5 — Fastest</option>
            </select>
          </div>

          {/* ── Maintenance ── */}
          <h2 className="section-header">
            Maintenance · <em className="italic ink-soft">Manutenzione</em>
          </h2>
          <div className="card" style={{ background: 'var(--paper-dark)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn-secondary">
                Export CSV · <em className="italic">Esporta CSV</em>
              </button>
              <button className="btn-secondary">
                Re-derive outdated entries · <em className="italic">Rideriva voci obsolete</em>
              </button>
            </div>
          </div>

          <p className="settings-version">Rules v{settings.rulesVersion}</p>

        </div>
        <Nav />
      </div>
    </AuthGuard>
  )
}
