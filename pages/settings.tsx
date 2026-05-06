import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import { useApp } from '../lib/context'
import { supabase } from '../lib/supabase'
import { exportCSV } from '../lib/exportCsv'
import { recomputeCosts } from '../lib/costs'
import { Location, DEFAULT_CUSTOMS_PROFILE, CustomsDeclarantProfile } from '../lib/types'

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

  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  function handleExportCSV() {
    exportCSV(state.log)
    showToast(`${state.log.length} items exported · File esportato`)
  }

  async function handleRederiveAll() {
    // Re-compute costs for every outdated entry using current rules (local math, no AI call)
    const { log, settings } = state
    const outdated = log.filter(e => e.rules_version && e.rules_version !== settings.rulesVersion)
    if (outdated.length === 0) {
      showToast('All entries are current · Tutto aggiornato')
      return
    }

    showToast(`Re-deriving ${outdated.length} entries… · Ricalcolo in corso…`)

    let updated = 0
    let failed = 0

    for (const entry of outdated) {
      const costs = recomputeCosts(entry, settings)
      const { data, error } = await supabase
        .from('cernita_entries')
        .update({
          ...costs,
          rules_version: settings.rulesVersion,
          rules_snapshot: settings as unknown as Record<string, unknown>,
        })
        .eq('id', entry.id)
        .select()
        .single()

      if (error) {
        failed++
        console.error(`Re-derive failed for entry ${entry.id}:`, error)
      } else if (data) {
        updated++
        dispatch({ type: 'UPSERT_ENTRY', entry: data })
      }
    }

    if (failed > 0) {
      showToast(`${updated} updated, ${failed} failed · ${updated} aggiornate, ${failed} errori`)
    } else {
      showToast(`${updated} entries updated to v${settings.rulesVersion} · Aggiornate`)
    }
  }

  const displayName = user?.user_metadata?.display_name ?? user?.email ?? 'User'

  return (
    <AuthGuard>
      <Head><title>Cernita — Settings</title></Head>
      <div className="app-shell">
        <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--paper-dark)' }}>
          <span className="serif" style={{ fontSize: '20px' }}>Settings · <em className="ink-soft" style={{ fontStyle: 'italic' }}>Impostazioni</em></span>
        </header>

        {toast && <div className="toast">{toast}</div>}

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

          {/* ── Currency ── */}
          <h2 className="section-header">
            Currency · <em className="italic ink-soft">Valuta</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            EUR/USD rate used for the Italian customs distinta. Update before generating the document.
          </p>
          <div className="card" style={{ marginBottom: 24 }}>
            <label className="input-label">EUR / USD exchange rate · Cambio EUR/USD</label>
            <input
              type="number"
              className="input"
              step="0.01"
              min="0.1"
              value={settings.eurRate}
              onChange={e => updateSetting('eurRate', parseFloat(e.target.value) || 0.92)}
            />
            <p className="settings-hint" style={{ marginTop: 6 }}>
              e.g. 0.92 means $1 = €0.92 · Default: 0.92
            </p>
          </div>

          {/* ── Italian destination ── */}
          <h2 className="section-header">
            Italian destination · <em className="italic ink-soft">Destinazione italiana</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Printed on customs-compliant box labels as the consignee address.
            Italian customs requires the full address (street, CAP, city, province).
          </p>
          <div className="card" style={{ marginBottom: 24 }}>
            <label className="input-label">Full Italian address · Indirizzo completo</label>
            <textarea
              className="input"
              rows={4}
              style={{ resize: 'vertical', fontFamily: 'var(--font-sans)' }}
              value={settings.italyAddress}
              onChange={e => updateSetting('italyAddress', e.target.value)}
              placeholder={`Via Example 42\n05059 Todi (PG)\nUmbria`}
            />
            <p className="settings-hint" style={{ marginTop: 6 }}>
              Example: Via Roma 42 · 05059 Todi (PG) · Umbria
            </p>
          </div>

          {/* ── Motion ── */}
          <h2 className="section-header">
            Animations · <em className="italic ink-soft">Animazioni</em>
          </h2>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: 2, fontSize: 14 }}>Motion &amp; haptics</p>
                <p className="settings-hint">
                  Count-up numbers, staggered lists, spring-back taps, and vibration feedback.
                  <br />
                  <em className="ink-soft" style={{ fontSize: 11 }}>Turn off to revert to no-motion mode.</em>
                </p>
              </div>
              <label className="toggle-switch" style={{ flexShrink: 0, marginLeft: 16 }}>
                <input
                  type="checkbox"
                  checked={settings.motionEnabled}
                  onChange={e => updateSetting('motionEnabled', e.target.checked)}
                />
                <span className="toggle-track">
                  <span className="toggle-thumb" />
                </span>
              </label>
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

          {/* ── Trip / suitcase defaults ── */}
          <h2 className="section-header">
            Trip bag limits · <em className="italic ink-soft">Limiti bagagli</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Default weight limits used when creating suitcases. Override per-bag on the Trips page.
          </p>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="input-label">Checked bag limit (lb) · Bagaglio da stiva</label>
                <input
                  type="number"
                  className="input"
                  step="1"
                  min="0"
                  value={settings.checkedBagLimitLb}
                  onChange={e => updateSetting('checkedBagLimitLb', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="input-label">Carry-on limit (lb) · Bagaglio a mano</label>
                <input
                  type="number"
                  className="input"
                  step="1"
                  min="0"
                  value={settings.carryOnLimitLb}
                  onChange={e => updateSetting('carryOnLimitLb', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="input-label">Personal item limit (lb) · Oggetto personale</label>
                <input
                  type="number"
                  className="input"
                  step="1"
                  min="0"
                  value={settings.personalItemLimitLb}
                  onChange={e => updateSetting('personalItemLimitLb', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* ── Locations ── */}
          <h2 className="section-header">
            Locations · <em className="italic ink-soft">Posizioni</em>
          </h2>
          <div className="card" style={{ marginBottom: 24 }}>
            <LocationsManager />
          </div>

          {/* ── Customs declaration profile ── */}
          <h2 className="section-header">
            Customs declaration · <em className="italic ink-soft">Dichiarazione doganale</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Declarant details for the Italian customs exemption under EU Reg. 1186/2009.
            As US citizens, you qualify for duty-free import of personal goods owned 6+ months.
          </p>
          <CustomsProfileEditor
            profile={settings.customsProfile ?? DEFAULT_CUSTOMS_PROFILE}
            italyAddressFallback={settings.italyAddress}
            onChange={(p) => updateSetting('customsProfile', p)}
          />

          {/* ── Documents ── */}
          <h2 className="section-header">
            Documents · <em className="italic ink-soft">Documenti</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Print-to-PDF documents for customs, insurance, and shipping records.
          </p>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a
                href="/customs"
                className="btn-secondary"
                style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}
              >
                🇮🇹 Customs declaration · <em className="italic">Dichiarazione doganale</em>
                {state.log.filter(e => e.final_decision === 'SHIP-ITALY').length > 0 && (
                  <span className="ink-soft" style={{ fontSize: 11, marginLeft: 8 }}>
                    ({state.log.filter(e => e.final_decision === 'SHIP-ITALY').length} SHIP-ITALY items)
                  </span>
                )}
              </a>
              <a
                href="/export/inventory"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}
              >
                📄 Inventory with photos · <em className="italic">Inventario con foto</em>
                {state.log.length > 0 && (
                  <span className="ink-soft" style={{ fontSize: 11, marginLeft: 8 }}>
                    ({state.log.length} items)
                  </span>
                )}
              </a>
              <a
                href="/distinta"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}
              >
                🇮🇹 Distinta doganale italiana · <em className="italic">Italian customs distinta (legacy)</em>
              </a>
              <a
                href="/labels"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}
              >
                🏷 Etichette scatole · <em className="italic">Box labels (customs-compliant)</em>
                {state.boxes.filter(b => b.destination === 'SHIP-ITALY').length > 0 && (
                  <span className="ink-soft" style={{ fontSize: 11, marginLeft: 8 }}>
                    ({state.boxes.filter(b => b.destination === 'SHIP-ITALY').length} Italy-bound boxes)
                  </span>
                )}
              </a>
            </div>
          </div>

          {/* ── Maintenance ── */}
          <h2 className="section-header">
            Maintenance · <em className="italic ink-soft">Manutenzione</em>
          </h2>
          <div className="card" style={{ background: 'var(--paper-dark)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn-secondary" onClick={handleExportCSV}>
                Export CSV · <em className="italic">Esporta CSV</em>
                {state.log.length > 0 && (
                  <span className="ink-soft" style={{ fontSize: 11, marginLeft: 8 }}>
                    ({state.log.length} items)
                  </span>
                )}
              </button>
              <button className="btn-secondary" onClick={handleRederiveAll}>
                Re-derive outdated entries · <em className="italic">Rideriva voci obsolete</em>
              </button>
            </div>
          </div>

          <p className="settings-version">Rules v{settings.rulesVersion}</p>

          {/* ── Data deletion (Constitution P3) ── */}
          <h2 className="section-header" style={{ marginTop: 32 }}>
            Data · <em className="italic ink-soft">Dati</em>
          </h2>
          <DataDeletion />

        </div>
        <Nav />
      </div>
    </AuthGuard>
  )
}

// ─── LocationsManager ─────────────────────────────────────────────────────────

function LocationsManager() {
  const { state, dispatch } = useApp()
  const { locations, boxes } = state

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editNameIt, setEditNameIt] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNameIt, setNewNameIt] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const sorted = [...locations].sort((a, b) => a.sort_order - b.sort_order)

  function boxCountAt(locationId: number) {
    return boxes.filter(b => b.current_location_id === locationId).length
  }

  async function handleReorder(loc: Location, direction: 'up' | 'down') {
    const idx = sorted.findIndex(l => l.id === loc.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    setSaving(true)
    await Promise.all([
      supabase.from('cernita_locations').update({ sort_order: other.sort_order }).eq('id', loc.id),
      supabase.from('cernita_locations').update({ sort_order: loc.sort_order }).eq('id', other.id),
    ])
    setSaving(false)
    dispatch({ type: 'UPSERT_LOCATION', location: { ...loc, sort_order: other.sort_order } })
    dispatch({ type: 'UPSERT_LOCATION', location: { ...other, sort_order: loc.sort_order } })
  }

  function startEdit(loc: Location) {
    setEditingId(loc.id)
    setEditName(loc.name)
    setEditNameIt(loc.name_it ?? '')
    setConfirmDeleteId(null)
    setError('')
  }

  async function handleSaveEdit(id: number) {
    if (!editName.trim()) { setError('Name is required'); return }
    setSaving(true)
    const { data, error: err } = await supabase
      .from('cernita_locations')
      .update({ name: editName.trim(), name_it: editNameIt.trim() || null })
      .eq('id', id)
      .select()
      .single()
    setSaving(false)
    if (err || !data) { setError('Save failed — try again'); return }
    dispatch({ type: 'UPSERT_LOCATION', location: data as Location })
    setEditingId(null)
  }

  async function handleDelete(loc: Location) {
    const count = boxCountAt(loc.id)
    if (count > 0) { setError(`Move ${count} box${count !== 1 ? 'es' : ''} out of "${loc.name}" first`); return }
    setSaving(true)
    const { error: err } = await supabase.from('cernita_locations').delete().eq('id', loc.id)
    setSaving(false)
    if (err) { setError('Delete failed — try again'); return }
    dispatch({ type: 'DELETE_LOCATION', id: loc.id })
    setEditingId(null)
    setConfirmDeleteId(null)
  }

  async function handleAdd() {
    if (!newName.trim()) return
    const maxOrder = sorted.length > 0 ? Math.max(...sorted.map(l => l.sort_order)) : 0
    setSaving(true)
    const { data, error: err } = await supabase
      .from('cernita_locations')
      .insert({ name: newName.trim(), name_it: newNameIt.trim() || null, sort_order: maxOrder + 10 })
      .select()
      .single()
    setSaving(false)
    if (err || !data) { setError('Add failed — try again'); return }
    dispatch({ type: 'UPSERT_LOCATION', location: data as Location })
    setNewName('')
    setNewNameIt('')
    setShowAdd(false)
    setError('')
  }

  const { syncStatus } = state

  if (syncStatus === 'syncing') {
    return <p className="settings-hint">Loading locations…</p>
  }

  if (locations.length === 0) {
    return (
      <div>
        <p className="settings-hint" style={{ marginBottom: 12 }}>
          No locations found. If you haven't run the database migration yet, open{' '}
          <strong>Supabase → SQL Editor</strong> and run{' '}
          <code style={{ fontSize: 12, background: 'var(--paper-dark)', padding: '1px 4px', borderRadius: 3 }}>
            docs/migration-006-boxes-locations.sql
          </code>
          , then reload the page.
        </p>
        <button className="btn-secondary" style={{ width: '100%' }} onClick={() => window.location.reload()}>
          Reload · Ricarica
        </button>
      </div>
    )
  }

  return (
    <div>
      {error && <p className="eval-error-text" style={{ marginBottom: 10 }}>{error}</p>}

      {sorted.map((loc, idx) => {
        const count = boxCountAt(loc.id)
        const isEditing = editingId === loc.id

        return (
          <div key={loc.id} className="loc-row">
            {isEditing ? (
              <div className="loc-edit-form">
                <label className="input-label">Name in English</label>
                <input
                  className="input"
                  style={{ marginBottom: 8 }}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="e.g. Colorado Springs storage"
                />
                <label className="input-label">Nome in italiano (opzionale)</label>
                <input
                  className="input"
                  style={{ marginBottom: 14 }}
                  value={editNameIt}
                  onChange={e => setEditNameIt(e.target.value)}
                  placeholder="e.g. Deposito a Colorado Springs"
                />
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => { setEditingId(null); setError('') }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    style={{ flex: 2 }}
                    onClick={() => handleSaveEdit(loc.id)}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save · Salva'}
                  </button>
                </div>

                {confirmDeleteId === loc.id ? (
                  <div className="delete-confirm">
                    <p className="delete-confirm-text">Delete <strong>{loc.name}</strong>?</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                      <button
                        className="btn-destructive"
                        style={{ flex: 1 }}
                        onClick={() => handleDelete(loc)}
                        disabled={saving || count > 0}
                      >
                        {saving ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn-destructive"
                    style={{ width: '100%' }}
                    onClick={() => {
                      if (count > 0) setError(`Move ${count} box${count !== 1 ? 'es' : ''} out of "${loc.name}" before deleting`)
                      else setConfirmDeleteId(loc.id)
                    }}
                  >
                    Delete · Elimina{count > 0 ? ` (${count} box${count !== 1 ? 'es' : ''} here)` : ''}
                  </button>
                )}
              </div>
            ) : (
              <div className="loc-row-content">
                <div className="loc-order-btns">
                  <button
                    className="loc-order-btn"
                    onClick={() => handleReorder(loc, 'up')}
                    disabled={idx === 0 || saving}
                    aria-label="Move up"
                  >↑</button>
                  <button
                    className="loc-order-btn"
                    onClick={() => handleReorder(loc, 'down')}
                    disabled={idx === sorted.length - 1 || saving}
                    aria-label="Move down"
                  >↓</button>
                </div>
                <div className="loc-names">
                  <span className="loc-name">{loc.name}</span>
                  {loc.name_it && loc.name_it !== loc.name && (
                    <span className="loc-name-it"> · {loc.name_it}</span>
                  )}
                  {count > 0 && (
                    <span className="loc-box-count">{count} box{count !== 1 ? 'es' : ''}</span>
                  )}
                </div>
                <button className="loc-edit-btn" onClick={() => startEdit(loc)} aria-label="Edit location">
                  ✎
                </button>
              </div>
            )}
          </div>
        )
      })}

      {showAdd ? (
        <div className="loc-add-form">
          <label className="input-label">Name in English</label>
          <input
            className="input"
            style={{ marginBottom: 10 }}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Dad's garage"
            autoFocus
          />
          <label className="input-label">Nome in italiano (opzionale)</label>
          <input
            className="input"
            style={{ marginBottom: 14 }}
            value={newNameIt}
            onChange={e => setNewNameIt(e.target.value)}
            placeholder="e.g. Garage di papà"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => { setShowAdd(false); setNewName(''); setNewNameIt(''); setError('') }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              style={{ flex: 2 }}
              onClick={handleAdd}
              disabled={saving || !newName.trim()}
            >
              {saving ? 'Adding…' : 'Add · Aggiungi'}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-secondary"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => { setShowAdd(true); setError('') }}
        >
          + Add location · Aggiungi posizione
        </button>
      )}
    </div>
  )
}

// ─── CustomsProfileEditor ────────────────────────────────────────────────────

const PORT_OPTIONS = ['Genova', 'Livorno', 'Napoli', 'Roma Fiumicino', 'Trieste', 'Venezia', 'Other']

function CustomsProfileEditor({
  profile,
  italyAddressFallback,
  onChange,
}: {
  profile: CustomsDeclarantProfile
  italyAddressFallback: string
  onChange: (p: CustomsDeclarantProfile) => void
}) {
  function update<K extends keyof CustomsDeclarantProfile>(key: K, value: CustomsDeclarantProfile[K]) {
    onChange({ ...profile, [key]: value })
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Joint toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Joint declaration</p>
            <p className="settings-hint">Both names on the customs filing</p>
          </div>
          <label className="toggle-switch" style={{ flexShrink: 0, marginLeft: 16 }}>
            <input
              type="checkbox"
              checked={profile.bothDeclarants}
              onChange={e => update('bothDeclarants', e.target.checked)}
            />
            <span className="toggle-track"><span className="toggle-thumb" /></span>
          </label>
        </div>

        {/* Primary declarant */}
        <div>
          <label className="input-label">Full legal name · Nome completo</label>
          <input
            type="text"
            className="input"
            value={profile.namePrimary}
            onChange={e => update('namePrimary', e.target.value)}
            placeholder="e.g. John A. Smith"
          />
        </div>
        <div>
          <label className="input-label">Date of birth · Data di nascita</label>
          <input
            type="date"
            className="input"
            value={profile.dobPrimary}
            onChange={e => update('dobPrimary', e.target.value)}
          />
        </div>
        <div>
          <label className="input-label">Nationality · Cittadinanza</label>
          <input
            type="text"
            className="input"
            value={profile.nationalityPrimary}
            onChange={e => update('nationalityPrimary', e.target.value)}
            placeholder="American"
          />
        </div>

        {/* Secondary declarant */}
        {profile.bothDeclarants && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--paper-dark)', margin: '4px 0' }} />
            <p className="input-label" style={{ fontWeight: 600 }}>Second declarant · Secondo dichiarante</p>
            <div>
              <label className="input-label">Full legal name</label>
              <input
                type="text"
                className="input"
                value={profile.nameSecondary}
                onChange={e => update('nameSecondary', e.target.value)}
                placeholder="e.g. Jane B. Smith"
              />
            </div>
            <div>
              <label className="input-label">Date of birth</label>
              <input
                type="date"
                className="input"
                value={profile.dobSecondary}
                onChange={e => update('dobSecondary', e.target.value)}
              />
            </div>
          </>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--paper-dark)', margin: '4px 0' }} />

        {/* Addresses */}
        <div>
          <label className="input-label">US address (prior residence) · Indirizzo USA</label>
          <textarea
            className="input"
            rows={3}
            style={{ resize: 'vertical' }}
            value={profile.usAddress}
            onChange={e => update('usAddress', e.target.value)}
            placeholder="123 Main St, Galesburg, IL 61401"
          />
        </div>
        <div>
          <label className="input-label">Italian address (destination) · Indirizzo Italia</label>
          <textarea
            className="input"
            rows={3}
            style={{ resize: 'vertical' }}
            value={profile.italyAddress || italyAddressFallback}
            onChange={e => update('italyAddress', e.target.value)}
            placeholder="Via Roma 42, 05059 Todi (PG), Umbria"
          />
          {!profile.italyAddress && italyAddressFallback && (
            <p className="settings-hint" style={{ marginTop: 4 }}>
              Using address from box labels settings
            </p>
          )}
        </div>

        {/* Logistics */}
        <div>
          <label className="input-label">Port of entry · Porto di ingresso</label>
          <select
            className="input"
            value={profile.portOfEntry}
            onChange={e => update('portOfEntry', e.target.value)}
          >
            <option value="">— Select —</option>
            {PORT_OPTIONS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">Estimated arrival date · Data di arrivo prevista</label>
          <input
            type="date"
            className="input"
            value={profile.arrivalDateEstimate}
            onChange={e => update('arrivalDateEstimate', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── DataDeletion (Constitution P3) ──────────────────────────────────────────

function DataDeletion() {
  const { state, dispatch } = useApp()
  const router = useRouter()
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting' | 'done'>('idle')
  const [error, setError] = useState('')

  const totalEntries = state.log.length
  const totalBoxes = state.boxes.length
  const totalTrips = state.trips.length
  const totalLocations = state.locations.length
  const totalItems = totalEntries + totalBoxes + totalTrips + totalLocations

  async function handleDeleteAll() {
    setStep('deleting')
    setError('')

    try {
      // Delete in dependency order: entries (have box_id FK) → boxes → trips → locations
      // Each delete uses a broad filter to catch all rows
      const { error: e1 } = await supabase.from('cernita_entries').delete().neq('id', 0)
      if (e1) throw new Error(`Entries: ${e1.message}`)

      const { error: e2 } = await supabase.from('cernita_boxes').delete().neq('id', 0)
      if (e2) throw new Error(`Boxes: ${e2.message}`)

      const { error: e3 } = await supabase.from('cernita_trips').delete().neq('id', 0)
      if (e3) throw new Error(`Trips: ${e3.message}`)

      const { error: e4 } = await supabase.from('cernita_locations').delete().neq('id', 0)
      if (e4) throw new Error(`Locations: ${e4.message}`)

      // Clear local state
      dispatch({ type: 'SET_LOG', entries: [] })
      dispatch({ type: 'SET_BOXES', boxes: [] })
      dispatch({ type: 'SET_TRIPS', trips: [] })
      dispatch({ type: 'SET_LOCATIONS', locations: [] })

      // Clear localStorage
      localStorage.removeItem('cernita_settings')

      setStep('done')

      // Sign out after a moment
      setTimeout(async () => {
        await supabase.auth.signOut()
        router.replace('/login')
      }, 3000)
    } catch (err) {
      console.error('Data deletion failed:', err)
      setError(err instanceof Error ? err.message : 'Deletion failed — try again')
      setStep('confirm')
    }
  }

  if (step === 'done') {
    return (
      <div className="card" style={{ marginBottom: 24, background: '#fdf0f0', border: '1px solid #f5c6c6' }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>All data deleted</p>
        <p className="ink-soft" style={{ fontSize: 13 }}>
          Signing out… · Disconnessione in corso…
        </p>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 24, background: '#fdf0f0', border: '1px solid #f5c6c6' }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>Delete all data · Elimina tutti i dati</p>
      <p className="ink-soft" style={{ fontSize: 13, marginBottom: 12 }}>
        Permanently delete all {totalItems} items ({totalEntries} entries, {totalBoxes} boxes,
        {' '}{totalTrips} trips, {totalLocations} locations), clear settings, and sign out.
        This cannot be undone.
      </p>
      <p className="italic ink-soft" style={{ fontSize: 12, marginBottom: 14 }}>
        Elimina permanentemente tutti i dati e disconnettiti. Non è possibile annullare.
      </p>

      {error && <p className="eval-error-text" style={{ marginBottom: 10 }}>{error}</p>}

      {step === 'confirm' ? (
        <div>
          <p style={{ fontWeight: 700, color: '#8b1a1a', fontSize: 14, marginBottom: 12 }}>
            Are you sure? This will delete everything. · Sei sicuro? Tutto verrà eliminato.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setStep('idle')}
            >
              Cancel
            </button>
            <button
              className="btn-destructive"
              style={{ flex: 2 }}
              onClick={handleDeleteAll}
            >
              Yes, delete everything · Sì, elimina tutto
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-destructive"
          style={{ width: '100%' }}
          onClick={() => setStep('confirm')}
          disabled={step === 'deleting'}
        >
          {step === 'deleting' ? 'Deleting… · Eliminazione…' : 'Delete all my data · Elimina tutti i dati'}
        </button>
      )}
    </div>
  )
}
