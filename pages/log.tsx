import Head from 'next/head'
import { useState, useEffect, useCallback } from 'react'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import SyncIndicator from '../components/SyncIndicator'
import { useApp } from '../lib/context'
import { supabase } from '../lib/supabase'
import { Entry, Box, Decision, DECISION_LABELS, DECISION_BADGE_CLASS, SUITCASE_CLASS_LABELS, getDecisionLabel, CernitaSettings } from '../lib/types'
import { exportCSV } from '../lib/exportCsv'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return `$${Math.abs(n).toFixed(0)}`
}

function fmtNet(n: number | null | undefined): string {
  if (n == null) return '—'
  const sign = n < 0 ? '−' : '+'
  return `${sign}$${Math.abs(n).toFixed(0)}`
}

// Re-compute costs from current rules (local math — no AI call)
function recomputeCosts(entry: Entry, settings: CernitaSettings) {
  const weight = entry.weight_lb ?? 0
  const volume = entry.volume_cuft ?? 0
  const resale = entry.estimated_resale_value ?? 0
  const ship_cost = weight * settings.shippingRatePerLb + volume * settings.shippingRatePerCuFt
  const storage_cost_total = volume * settings.storageRatePerCuFt * settings.monthsInStorage
  return {
    ship_cost: ship_cost || null,
    storage_cost_total: storage_cost_total || null,
    net_cost_ship: ship_cost ? ship_cost - resale : null,
    net_cost_storage: storage_cost_total ? storage_cost_total - resale : null,
  }
}

function isOutdated(entry: Entry, settings: CernitaSettings): boolean {
  return !!entry.rules_version && entry.rules_version !== settings.rulesVersion
}

const ALL_DECISIONS: Decision[] = [
  'KEEP-ITALY', 'KEEP-US', 'SELL', 'DONATE', 'DISPOSE', 'GIVE-FAMILY', 'NEEDS-HUMAN',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LogPage() {
  const { state, dispatch } = useApp()
  const { log: entries, boxes, settings, user } = state

  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [toast, setToast] = useState('')

  // Keep detail overlay in sync with Realtime updates
  useEffect(() => {
    if (!selectedEntry) return
    const updated = entries.find(e => e.id === selectedEntry.id)
    if (updated) setSelectedEntry(updated)
  }, [entries]) // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  // ─── Filtering ─────────────────────────────────────────────────────────────

  function toggleFilter(key: string) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const filtered = (() => {
    let result = activeFilters.size === 0 ? entries : entries.filter(e => {
      if (activeFilters.has('OUTDATED') && isOutdated(e, settings)) return true
      if (activeFilters.has(e.final_decision)) return true
      return false
    })
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(e =>
        e.item_name.toLowerCase().includes(q) ||
        (e.item_name_it?.toLowerCase().includes(q) ?? false)
      )
    }
    return result
  })()

  // ─── Summary counts ────────────────────────────────────────────────────────

  const counts = ALL_DECISIONS.reduce((acc, d) => {
    acc[d] = entries.filter(e => e.final_decision === d).length
    return acc
  }, {} as Record<Decision, number>)

  const outdatedCount = entries.filter(e => isOutdated(e, settings)).length

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AuthGuard>
      <Head><title>Cernita — Log</title></Head>
      <div className="app-shell">

        <header className="log-header">
          <span className="serif" style={{ fontSize: '20px' }}>Log</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {entries.length > 0 && (
              <button
                className="btn-link"
                style={{ fontSize: 12, textDecoration: 'none', color: 'var(--ink-soft)' }}
                onClick={() => {
                  exportCSV(entries)
                  showToast(`${entries.length} items exported · File esportato`)
                }}
              >
                ↓ CSV
              </button>
            )}
            <SyncIndicator />
          </div>
        </header>

        {toast && <div className="toast">{toast}</div>}

        {/* Search bar */}
        {entries.length > 0 && (
          <div className="log-search">
            <input
              className="log-search-input"
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search items… · Cerca…"
            />
            {searchQuery && (
              <button className="log-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">✕</button>
            )}
          </div>
        )}

        <div className="page-content">

          {/* Summary bar */}
          {entries.length > 0 && (
            <div className="log-summary">
              <span className="log-summary-total">
                {activeFilters.size > 0
                  ? `Showing ${filtered.length} of ${entries.length}`
                  : `${entries.length} item${entries.length !== 1 ? 's' : ''}`}
              </span>
              <span className="log-summary-breakdown">
                {ALL_DECISIONS.filter(d => counts[d] > 0).map(d => (
                  <span key={d} className="log-summary-chip">
                    {counts[d]} {getDecisionLabel(d, settings.usDestination).it}
                  </span>
                ))}
              </span>
            </div>
          )}

          {/* Filter pills */}
          {entries.length > 0 && (
            <div className="log-filters">
              <button
                className={`filter-pill ${activeFilters.size === 0 ? 'active' : ''}`}
                onClick={() => setActiveFilters(new Set())}
              >
                All
              </button>
              {ALL_DECISIONS.filter(d => counts[d] > 0).map(d => {
                const lbl = getDecisionLabel(d, settings.usDestination)
                const short = lbl.en.split('—').pop()?.trim() ?? lbl.en
                return (
                  <button
                    key={d}
                    className={`filter-pill ${activeFilters.has(d) ? 'active' : ''}`}
                    onClick={() => toggleFilter(d)}
                  >
                    {short}
                    <span className="filter-pill-count">{counts[d]}</span>
                  </button>
                )
              })}
              {outdatedCount > 0 && (
                <button
                  className={`filter-pill filter-pill-outdated ${activeFilters.has('OUTDATED') ? 'active' : ''}`}
                  onClick={() => toggleFilter('OUTDATED')}
                >
                  ⟳ Outdated
                  <span className="filter-pill-count">{outdatedCount}</span>
                </button>
              )}
            </div>
          )}

          {/* List */}
          {filtered.length === 0 ? (
            <EmptyState
              hasEntries={entries.length > 0}
              hasFilters={activeFilters.size > 0}
              hasSearch={!!searchQuery.trim()}
              onClear={() => { setActiveFilters(new Set()); setSearchQuery('') }}
            />
          ) : (
            <div className="log-list">
              {filtered.map(entry => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  outdated={isOutdated(entry, settings)}
                  onClick={() => setSelectedEntry(entry)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail overlay */}
        {selectedEntry && (
          <DetailOverlay
            entry={selectedEntry}
            settings={settings}
            boxes={boxes}
            currentUser={user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? 'you'}
            onClose={() => setSelectedEntry(null)}
            onSaved={(updated) => {
              dispatch({ type: 'UPSERT_ENTRY', entry: updated })
              showToast('Saved · Salvato')
            }}
            onDeleted={(id) => {
              dispatch({ type: 'DELETE_ENTRY', id })
              setSelectedEntry(null)
              showToast('Deleted · Eliminato')
            }}
          />
        )}

        <Nav />
      </div>
    </AuthGuard>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ hasEntries, hasFilters, hasSearch, onClear }: {
  hasEntries: boolean
  hasFilters: boolean
  hasSearch: boolean
  onClear: () => void
}) {
  if (hasSearch || hasFilters) {
    return (
      <div className="empty-state">
        <h3>No matches</h3>
        <p className="italic ink-soft" style={{ marginBottom: 16 }}>Nessun risultato.</p>
        <button className="btn-secondary" onClick={onClear}>Clear · Cancella</button>
      </div>
    )
  }
  if (!hasEntries) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: 40, marginBottom: 12 }}>◎</div>
        <h3>No items yet</h3>
        <p className="italic ink-soft">Nessun oggetto valutato ancora.</p>
        <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-soft)' }}>
          Tap Evaluate to add your first item.
        </p>
      </div>
    )
  }
  return null
}

// ─── EntryRow ─────────────────────────────────────────────────────────────────

function EntryRow({ entry, outdated, onClick }: {
  entry: Entry
  outdated: boolean
  onClick: () => void
}) {
  return (
    <button className="entry-row" onClick={onClick}>
      {/* Photo thumbnail */}
      <div className="entry-thumb">
        {entry.photo_data ? (
          <img
            src={`data:image/jpeg;base64,${entry.photo_data}`}
            alt=""
            className="entry-thumb-img"
          />
        ) : (
          <span className="entry-thumb-placeholder">◻</span>
        )}
      </div>

      {/* Names + meta */}
      <div className="entry-row-body">
        <div className="entry-row-top">
          <span className="entry-name">{entry.item_name}</span>
          <div className="entry-badges">
            {outdated && <span className="badge-outdated">⟳</span>}
            {entry.override_reason && <span className="badge-override">↩</span>}
            <span className={DECISION_BADGE_CLASS[entry.final_decision as Decision] ?? 'badge'}>
              {entry.final_decision.replace('KEEP-', '').replace('-', ' ')}
            </span>
          </div>
        </div>
        {entry.item_name_it && (
          <div className="entry-name-it">{entry.item_name_it}</div>
        )}
        <div className="entry-meta">
          {entry.user_name} · {timeAgo(entry.created_at)}
        </div>
      </div>
    </button>
  )
}

// ─── DetailOverlay ────────────────────────────────────────────────────────────

function DetailOverlay({ entry, settings, boxes, currentUser, onClose, onSaved, onDeleted }: {
  entry: Entry
  settings: CernitaSettings
  boxes: Box[]
  currentUser: string
  onClose: () => void
  onSaved: (e: Entry) => void
  onDeleted: (id: number) => void
}) {
  const outdated = isOutdated(entry, settings)
  const [showOverride, setShowOverride] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Override form state
  const [overrideDecision, setOverrideDecision] = useState<Decision>(entry.final_decision)
  const [overrideReason, setOverrideReason] = useState('')

  // Box assignment state
  const [selectedBoxId, setSelectedBoxId] = useState<number | null | ''>(entry.box_id ?? null)
  const [savingBox, setSavingBox] = useState(false)

  // ── Save override ──────────────────────────────────────────────────────────
  async function handleOverrideSave() {
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('cernita_entries')
      .update({
        final_decision: overrideDecision,
        override_reason: overrideReason || null,
        user_confirmed: true,
        user_name: currentUser,
      })
      .eq('id', entry.id)
      .select()
      .single()

    setSaving(false)
    if (err || !data) { setError('Save failed — try again.'); return }
    onSaved(data as Entry)
    setShowOverride(false)
    setOverrideReason('')
  }

  // ── Accept re-derived costs ───────────────────────────────────────────────
  async function handleAcceptRederive() {
    setSaving(true)
    setError('')
    const newCosts = recomputeCosts(entry, settings)
    const { data, error: err } = await supabase
      .from('cernita_entries')
      .update({
        ...newCosts,
        rules_version: settings.rulesVersion,
        rules_snapshot: settings as unknown as Record<string, unknown>,
        override_reason: null,
      })
      .eq('id', entry.id)
      .select()
      .single()

    setSaving(false)
    if (err || !data) { setError('Save failed — try again.'); return }
    onSaved(data as Entry)
  }

  // ── Keep current decision (just update rules stamp) ───────────────────────
  async function handleKeepCurrent() {
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('cernita_entries')
      .update({
        rules_version: settings.rulesVersion,
        rules_snapshot: settings as unknown as Record<string, unknown>,
      })
      .eq('id', entry.id)
      .select()
      .single()

    setSaving(false)
    if (err || !data) { setError('Save failed — try again.'); return }
    onSaved(data as Entry)
  }

  // ── Box assignment ────────────────────────────────────────────────────────
  async function handleBoxAssign() {
    setSavingBox(true)
    setError('')
    const newBoxId = selectedBoxId === '' ? null : (selectedBoxId as number | null)
    const { data, error: err } = await supabase
      .from('cernita_entries')
      .update({ box_id: newBoxId })
      .eq('id', entry.id)
      .select()
      .single()
    setSavingBox(false)
    if (err || !data) { setError('Save failed — try again.'); return }
    onSaved(data as Entry)
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    setSaving(true)
    const { error: err } = await supabase
      .from('cernita_entries')
      .delete()
      .eq('id', entry.id)

    setSaving(false)
    if (err) { setError('Delete failed — try again.'); return }
    onDeleted(entry.id)
  }

  const label = getDecisionLabel(entry.final_decision as Decision, settings.usDestination)
  const badgeClass = DECISION_BADGE_CLASS[entry.final_decision as Decision] ?? 'badge'
  const showPreservation = entry.fragility && entry.fragility !== 'none'
  const newCosts = outdated ? recomputeCosts(entry, settings) : null
  const confidence = entry.confidence ?? 'medium'

  return (
    <div className="overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="detail-sheet">

        {/* Header */}
        <div className="detail-header">
          <button className="detail-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Photo */}
        <div className="detail-photo">
          {entry.photo_data ? (
            <img
              src={`data:image/jpeg;base64,${entry.photo_data}`}
              alt={entry.item_name}
              className="detail-photo-img"
            />
          ) : (
            <div className="detail-photo-placeholder">
              <span>◻</span>
            </div>
          )}
        </div>

        <div className="detail-body">

          {/* Decision + name */}
          <div className="detail-decision-row">
            <span className={`${badgeClass} detail-badge`}>{label.en}</span>
            {label.it && <em className="serif detail-decision-it">{label.it}</em>}
          </div>

          <h2 className="detail-name serif">
            {entry.item_name}
            {entry.item_name_it && (
              <em className="detail-name-it"> · {entry.item_name_it}</em>
            )}
          </h2>

          <p className="detail-attribution">
            Evaluated by {entry.user_name} · {timeAgo(entry.created_at)}
          </p>

          {/* Outdated diff block */}
          {outdated && newCosts && (
            <div className="outdated-block">
              <p className="outdated-label">⟳ Rules updated since this evaluation</p>
              <div className="outdated-costs">
                <div className="outdated-cost-row">
                  <span>Old net (ship)</span>
                  <span>{fmtNet(entry.net_cost_ship)} → <strong>{fmtNet(newCosts.net_cost_ship)}</strong></span>
                </div>
                <div className="outdated-cost-row">
                  <span>Old net (storage)</span>
                  <span>{fmtNet(entry.net_cost_storage)} → <strong>{fmtNet(newCosts.net_cost_storage)}</strong></span>
                </div>
              </div>
              <div className="outdated-actions">
                <button className="btn-secondary" onClick={handleKeepCurrent} disabled={saving}>
                  Keep as-is · Mantieni
                </button>
                <button className="btn-primary" onClick={handleAcceptRederive} disabled={saving}>
                  Accept new costs · Aggiorna
                </button>
              </div>
            </div>
          )}

          {/* Economics table */}
          <DetailEconomicsTable entry={entry} />

          {/* Confidence */}
          <div className="confidence-row" style={{ marginBottom: 16 }}>
            <span className={`confidence-pill confidence-${confidence}`}>{confidence}</span>
            <span className="ink-soft" style={{ fontSize: 12 }}>confidence · fiducia</span>
          </div>

          {/* Rationale */}
          {entry.recommendation_rationale && (
            <div className="rationale-section">
              <p>{entry.recommendation_rationale}</p>
              {entry.recommendation_rationale_it && (
                <p className="italic" style={{ color: 'var(--ink-soft)', marginTop: 8 }}>
                  {entry.recommendation_rationale_it}
                </p>
              )}
            </div>
          )}

          {/* Preservation */}
          {showPreservation && (
            <div className="preservation-block">
              <p className="preservation-label">
                Fragility · Fragilità:{' '}
                <span className={`fragility-badge fragility-${entry.fragility}`}>{entry.fragility}</span>
              </p>
              {entry.survival_risk && (
                <p className="preservation-text">
                  ⚠ {entry.survival_risk}
                  {entry.survival_risk_it && (
                    <em className="italic" style={{ display: 'block', color: 'var(--ink-soft)', marginTop: 3 }}>
                      {entry.survival_risk_it}
                    </em>
                  )}
                </p>
              )}
              {entry.packing_notes && (
                <p className="preservation-text" style={{ marginTop: 8 }}>
                  📦 {entry.packing_notes}
                  {entry.packing_notes_it && (
                    <em className="italic" style={{ display: 'block', color: 'var(--ink-soft)', marginTop: 3 }}>
                      {entry.packing_notes_it}
                    </em>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Box assignment */}
          {boxes.length > 0 && (
            <div className="box-assign-section">
              <p className="box-assign-label">Box · Scatola</p>
              {entry.box_id ? (
                <p className="box-assign-current">
                  Currently in <strong className="box-number" style={{ fontSize: 13 }}>
                    {boxes.find(b => b.id === entry.box_id)?.box_number ?? `#${entry.box_id}`}
                  </strong>
                </p>
              ) : (
                <p className="box-assign-current">Not packed · Non ancora inscatolato</p>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  className="input"
                  style={{ flex: 1, fontSize: 13, padding: '8px 10px' }}
                  value={selectedBoxId === null ? '' : selectedBoxId}
                  onChange={e => setSelectedBoxId(e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">— No box —</option>
                  {boxes.filter(b => !b.closed_at && b.box_type !== 'suitcase').map(b => {
                    const lbl = getDecisionLabel(b.destination, settings.usDestination)
                    return (
                      <option key={b.id} value={b.id}>
                        {b.box_number} · {lbl.en.split('—').pop()?.trim()}
                      </option>
                    )
                  })}
                  {boxes.some(b => !b.closed_at && b.box_type === 'suitcase') && (
                    <optgroup label="🧳 Suitcases">
                      {boxes.filter(b => !b.closed_at && b.box_type === 'suitcase').map(b => {
                        const classLbl = b.suitcase_class
                          ? SUITCASE_CLASS_LABELS[b.suitcase_class as keyof typeof SUITCASE_CLASS_LABELS]?.en
                          : 'Suitcase'
                        return (
                          <option key={b.id} value={b.id}>
                            {b.box_number} · {classLbl}
                          </option>
                        )
                      })}
                    </optgroup>
                  )}
                  {boxes.some(b => b.closed_at) && (
                    <optgroup label="Closed boxes">
                      {boxes.filter(b => b.closed_at).map(b => {
                        const lbl = getDecisionLabel(b.destination, settings.usDestination)
                        return (
                          <option key={b.id} value={b.id}>
                            {b.box_number} · {lbl.en.split('—').pop()?.trim()} (closed)
                          </option>
                        )
                      })}
                    </optgroup>
                  )}
                </select>
                <button
                  className="btn-secondary"
                  style={{ whiteSpace: 'nowrap', padding: '8px 14px', fontSize: 13 }}
                  onClick={handleBoxAssign}
                  disabled={savingBox || selectedBoxId === (entry.box_id ?? null)}
                >
                  {savingBox ? '…' : 'Assign · Assegna'}
                </button>
              </div>
            </div>
          )}

          {/* Override reason (if set) */}
          {entry.override_reason && (
            <div className="override-note">
              <span className="override-note-label">↩ Override by {entry.user_name}</span>
              <p className="override-note-text">{entry.override_reason}</p>
            </div>
          )}

          {/* Rules version */}
          {entry.rules_version && (
            <p className="detail-rules-version">
              Rules v{entry.rules_version} · {new Date(entry.created_at).toLocaleDateString()}
            </p>
          )}

          {error && <p className="eval-error-text" style={{ marginTop: 12 }}>{error}</p>}

          {/* ── Override form ── */}
          {showOverride ? (
            <div className="override-inline">
              <label className="input-label">Decision · Decisione</label>
              <select
                className="input"
                value={overrideDecision}
                onChange={e => setOverrideDecision(e.target.value as Decision)}
                style={{ marginBottom: 12 }}
              >
                {ALL_DECISIONS.map(d => {
                  const lbl = getDecisionLabel(d, settings.usDestination)
                  return <option key={d} value={d}>{lbl.en} · {lbl.it}</option>
                })}
              </select>

              <label className="input-label">Reason · Motivo</label>
              <textarea
                className="input"
                style={{ minHeight: 72, resize: 'vertical', marginBottom: 16 }}
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="Why are you changing this? · Perché stai cambiando?"
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowOverride(false)} disabled={saving}>
                  Cancel
                </button>
                <button className="btn-primary" style={{ flex: 2 }} onClick={handleOverrideSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save override · Salva'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn-secondary"
              style={{ width: '100%', marginTop: 20 }}
              onClick={() => { setOverrideDecision(entry.final_decision); setShowOverride(true) }}
            >
              Override decision · Cambia decisione
            </button>
          )}

          {/* ── Delete ── */}
          {showDelete ? (
            <div className="delete-confirm">
              <p className="delete-confirm-text">
                Delete <strong>{entry.item_name}</strong>?<br />
                <span style={{ fontStyle: 'italic', color: 'var(--ink-soft)', fontSize: 13 }}>
                  This cannot be undone · Non è possibile annullare.
                </span>
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowDelete(false)} disabled={saving}>
                  Cancel
                </button>
                <button className="btn-destructive" style={{ flex: 1 }} onClick={handleDelete} disabled={saving}>
                  {saving ? 'Deleting…' : 'Delete · Elimina'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn-destructive"
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => setShowDelete(true)}
            >
              Delete entry · Elimina
            </button>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── DetailEconomicsTable ─────────────────────────────────────────────────────

function DetailEconomicsTable({ entry }: { entry: Entry }) {
  const hasAny =
    entry.ship_cost != null || entry.storage_cost_total != null ||
    entry.net_cost_ship != null || entry.net_cost_storage != null ||
    entry.estimated_resale_value != null || entry.replacement_cost != null ||
    entry.weight_lb != null || entry.volume_cuft != null

  if (!hasAny) return null

  return (
    <div className="economics-section" style={{ marginBottom: 16 }}>
      <p className="economics-label">Economics · Costi</p>
      <table className="economics-table">
        <tbody>
          {entry.estimated_resale_value != null && (
            <tr>
              <td>Resale value <em style={{ fontSize: 10, color: 'var(--ink-soft)' }}>est.</em></td>
              <td className="num">{fmt(entry.estimated_resale_value)}</td>
            </tr>
          )}
          {entry.replacement_cost != null && (
            <tr>
              <td>Replace in Italy <em style={{ fontSize: 10, color: 'var(--ink-soft)' }}>est.</em></td>
              <td className="num">{fmt(entry.replacement_cost)}</td>
            </tr>
          )}
          {entry.ship_cost != null && (
            <tr><td>Ship cost</td><td className="num">{fmt(entry.ship_cost)}</td></tr>
          )}
          {entry.storage_cost_total != null && (
            <tr><td>Storage cost</td><td className="num">{fmt(entry.storage_cost_total)}</td></tr>
          )}
          {entry.net_cost_ship != null && (
            <tr className="net-row">
              <td><strong>Net if shipped</strong></td>
              <td className="num"><strong>{fmtNet(entry.net_cost_ship)}</strong></td>
            </tr>
          )}
          {entry.net_cost_storage != null && (
            <tr className="net-row">
              <td><strong>Net if stored</strong></td>
              <td className="num"><strong>{fmtNet(entry.net_cost_storage)}</strong></td>
            </tr>
          )}
          {entry.weight_lb != null && (
            <tr><td>Weight <em style={{ fontSize: 10, color: 'var(--ink-soft)' }}>est.</em></td><td className="num">{entry.weight_lb} lb</td></tr>
          )}
          {entry.volume_cuft != null && (
            <tr><td>Volume <em style={{ fontSize: 10, color: 'var(--ink-soft)' }}>est.</em></td><td className="num">{entry.volume_cuft} cu ft</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
