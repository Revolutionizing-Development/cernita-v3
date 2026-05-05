import Head from 'next/head'
import { useState, useCallback } from 'react'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import SyncIndicator from '../components/SyncIndicator'
import { useApp } from '../lib/context'
import { supabase } from '../lib/supabase'
import { Box, Location, Entry, Decision, DECISION_BADGE_CLASS, SUITCASE_CLASS_LABELS, getDecisionLabel } from '../lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextBoxNumber(boxes: Box[]): string {
  const nums = boxes
    .map(b => parseInt(b.box_number.replace('BOX-', ''), 10))
    .filter(n => !isNaN(n))
  const max = nums.length > 0 ? Math.max(...nums) : 0
  return `BOX-${String(max + 1).padStart(3, '0')}`
}

function getBoxItems(log: Entry[], boxId: number): Entry[] {
  return log.filter(e => e.box_id === boxId)
}

function getBoxWeight(log: Entry[], boxId: number): { total: number | null; unknownCount: number } {
  const items = getBoxItems(log, boxId)
  const known = items.filter(e => e.weight_lb != null)
  const unknownCount = items.length - known.length
  if (known.length === 0) return { total: null, unknownCount }
  return { total: known.reduce((s, e) => s + (e.weight_lb ?? 0), 0), unknownCount }
}

function weightColor(lb: number | null): string {
  if (lb == null) return 'var(--ink-soft)'
  if (lb <= 30)  return 'var(--olive)'
  if (lb <= 50)  return 'var(--gold)'
  if (lb <= 65)  return '#c0622f'
  return '#8b1a00'
}

function weightLabel(lb: number | null, unknownCount: number): string {
  if (lb == null && unknownCount > 0) return `? lb (${unknownCount} unknown)`
  if (lb == null) return '— lb'
  const suffix = unknownCount > 0 ? ` +${unknownCount} unknown` : ''
  return `${lb.toFixed(1)} lb${suffix}`
}

const VALID_DESTINATIONS: Decision[] = [
  'KEEP-ITALY', 'KEEP-US', 'SELL', 'DONATE', 'DISPOSE', 'GIVE-FAMILY',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BinsPage() {
  const { state, dispatch } = useApp()
  const { boxes, locations, log, settings, syncStatus } = state

  const [view, setView] = useState<'location' | 'destination'>('location')
  const [selectedBox, setSelectedBox] = useState<Box | null>(null)
  const [showNewBox, setShowNewBox] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  // Keep selected box in sync with Realtime
  if (selectedBox) {
    const fresh = boxes.find(b => b.id === selectedBox.id)
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedBox)) {
      // will re-render with fresh on next pass
    }
  }

  // Only show migration banner after data has loaded — not during initial sync
  const migrationNeeded = syncStatus === 'online' && locations.length === 0 && boxes.length === 0

  return (
    <AuthGuard>
      <Head><title>Cernita — Boxes</title></Head>
      <div className="app-shell">

        <header className="bins-header">
          <span className="serif" style={{ fontSize: '20px' }}>Boxes · <em className="ink-soft" style={{ fontStyle: 'italic', fontSize: '16px' }}>Scatole</em></span>
          <SyncIndicator />
        </header>

        {toast && <div className="toast">{toast}</div>}

        {/* View toggle */}
        <div className="bins-toggle">
          <button
            className={`bins-toggle-btn ${view === 'location' ? 'active' : ''}`}
            onClick={() => setView('location')}
          >
            By location
          </button>
          <button
            className={`bins-toggle-btn ${view === 'destination' ? 'active' : ''}`}
            onClick={() => setView('destination')}
          >
            By destination
          </button>
        </div>

        <div className="page-content">

          {/* Loading state */}
          {syncStatus === 'syncing' && boxes.length === 0 && (
            <p className="settings-hint" style={{ padding: '20px 0', textAlign: 'center' }}>
              Loading… · Caricamento…
            </p>
          )}

          {/* Migration needed banner */}
          {migrationNeeded && (
            <div className="migration-banner">
              <p className="migration-title">Run the database migration first</p>
              <p className="migration-body">
                Open <strong>Supabase → SQL Editor</strong> and run the contents of{' '}
                <code>docs/migration-006-boxes-locations.sql</code> from the repo.
                Then reload.
              </p>
              <button
                className="btn-secondary"
                style={{ marginTop: 12, width: '100%' }}
                onClick={() => window.location.reload()}
              >
                Reload · Ricarica
              </button>
            </div>
          )}

          {/* By location view */}
          {view === 'location' && !migrationNeeded && (
            <LocationView
              boxes={boxes}
              locations={locations}
              log={log}
              usDestination={settings.usDestination}
              onSelectBox={setSelectedBox}
              onNewBox={() => setShowNewBox(true)}
            />
          )}

          {/* By destination view */}
          {view === 'destination' && !migrationNeeded && (
            <DestinationView log={log} boxes={boxes} usDestination={settings.usDestination} />
          )}

        </div>

        {/* Box detail overlay */}
        {selectedBox && (
          <BoxDetailOverlay
            box={boxes.find(b => b.id === selectedBox.id) ?? selectedBox}
            locations={locations}
            log={log}
            usDestination={settings.usDestination}
            onClose={() => setSelectedBox(null)}
            onSaved={(box) => { dispatch({ type: 'UPSERT_BOX', box }); showToast('Saved · Salvato') }}
            onDeleted={(id) => { dispatch({ type: 'DELETE_BOX', id }); setSelectedBox(null); showToast('Box deleted · Scatola eliminata') }}
          />
        )}

        {/* New box overlay */}
        {showNewBox && (
          <NewBoxOverlay
            boxes={boxes}
            locations={locations}
            usDestination={settings.usDestination}
            onClose={() => setShowNewBox(false)}
            onCreated={(box) => {
              dispatch({ type: 'UPSERT_BOX', box })
              setShowNewBox(false)
              showToast(`${box.box_number} created · Creato`)
            }}
          />
        )}

        <Nav />
      </div>
    </AuthGuard>
  )
}

// ─── LocationView ─────────────────────────────────────────────────────────────

function LocationView({ boxes, locations, log, usDestination, onSelectBox, onNewBox }: {
  boxes: Box[]
  locations: Location[]
  log: Entry[]
  usDestination: string
  onSelectBox: (b: Box) => void
  onNewBox: () => void
}) {
  // Group boxes by location
  const grouped = new Map<number | null, Box[]>()
  for (const box of boxes) {
    const key = box.current_location_id
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(box)
  }

  // Loose items = items not in any box, grouped by their current_location_id
  function getLooseItems(locId: number | null): Entry[] {
    return log.filter(e => e.box_id == null && e.current_location_id === locId)
  }

  // Order: known locations by sort_order, then null (unassigned)
  const locationOrder = locations.map(l => l.id)
  const sections: { locationId: number | null; locationName: string; locationNameIt: string | null; boxList: Box[] }[] = []

  for (const locId of locationOrder) {
    const list = grouped.get(locId)
    if (list && list.length > 0) {
      const loc = locations.find(l => l.id === locId)!
      sections.push({ locationId: locId, locationName: loc.name, locationNameIt: loc.name_it, boxList: list })
    }
  }
  const unassigned = grouped.get(null)
  if (unassigned && unassigned.length > 0) {
    sections.push({ locationId: null, locationName: 'Unassigned', locationNameIt: 'Non assegnato', boxList: unassigned })
  }

  if (boxes.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
        <h3>No boxes yet</h3>
        <p className="italic ink-soft" style={{ marginBottom: 20 }}>Nessuna scatola ancora.</p>
        <button className="btn-primary" onClick={onNewBox}>+ New box · Nuova scatola</button>
      </div>
    )
  }

  return (
    <div>
      <button className="btn-primary" style={{ marginBottom: 20 }} onClick={onNewBox}>
        + New box · Nuova scatola
      </button>

      {sections.map(({ locationId, locationName, locationNameIt, boxList }) => {
        const totalWeight = boxList.reduce((sum, b) => {
          const { total } = getBoxWeight(log, b.id)
          return sum + (total ?? 0)
        }, 0)
        const looseItems = getLooseItems(locationId)
        return (
          <div key={locationId ?? 'unassigned'} className="location-section">
            <div className="location-section-header">
              <span className="location-section-name">{locationName}</span>
              {locationNameIt && locationNameIt !== locationName && (
                <em className="location-section-name-it"> · {locationNameIt}</em>
              )}
              <span className="location-section-meta">
                {boxList.length} box{boxList.length !== 1 ? 'es' : ''}
                {totalWeight > 0 && ` · ~${totalWeight.toFixed(0)} lb`}
                {looseItems.length > 0 && ` · ${looseItems.length} loose`}
              </span>
            </div>
            {boxList.map(box => (
              <BoxCard
                key={box.id}
                box={box}
                log={log}
                usDestination={usDestination}
                onClick={() => onSelectBox(box)}
              />
            ))}
            {looseItems.length > 0 && (
              <div className="loose-items-group">
                <p className="loose-items-label">◻ Loose items · Non inscatolati</p>
                {looseItems.map(e => (
                  <div key={e.id} className="loose-item-row">
                    <span className="loose-item-name">{e.item_name}</span>
                    {e.item_name_it && <span className="loose-item-name-it"> · {e.item_name_it}</span>}
                    {e.weight_lb != null && <span className="loose-item-weight">{e.weight_lb} lb</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Unlocated loose items — no box, no location */}
      {(() => {
        const unlocated = log.filter(e => e.box_id == null && e.current_location_id == null)
        if (unlocated.length === 0) return null
        return (
          <div className="location-section">
            <div className="location-section-header">
              <span className="location-section-name">Unlocated · Senza posizione</span>
              <span className="location-section-meta">{unlocated.length} loose</span>
            </div>
            <div className="loose-items-group">
              <p className="loose-items-label">◻ Not in a box or location</p>
              {unlocated.map(e => (
                <div key={e.id} className="loose-item-row">
                  <span className="loose-item-name">{e.item_name}</span>
                  {e.item_name_it && <span className="loose-item-name-it"> · {e.item_name_it}</span>}
                  {e.weight_lb != null && <span className="loose-item-weight">{e.weight_lb} lb</span>}
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── DestinationView ──────────────────────────────────────────────────────────

function DestinationView({ log, boxes, usDestination }: { log: Entry[]; boxes: Box[]; usDestination: string }) {
  const unboxed = log.filter(e => e.box_id == null)
  const byDecision = new Map<string, Entry[]>()
  for (const e of unboxed) {
    if (!byDecision.has(e.final_decision)) byDecision.set(e.final_decision, [])
    byDecision.get(e.final_decision)!.push(e)
  }

  const boxed = log.filter(e => e.box_id != null)

  return (
    <div>
      {boxed.length > 0 && (
        <p className="settings-hint" style={{ marginBottom: 16 }}>
          {boxed.length} item{boxed.length !== 1 ? 's' : ''} already in boxes.{' '}
          {log.length - boxed.length} unboxed below.
        </p>
      )}

      {unboxed.length === 0 ? (
        <div className="empty-state">
          <h3>All items are boxed</h3>
          <p className="italic ink-soft">Tutti gli oggetti sono in scatola.</p>
        </div>
      ) : (
        Array.from(byDecision.entries()).map(([decision, items]) => {
          const label = getDecisionLabel(decision as Decision, usDestination)
          return (
            <div key={decision} className="location-section">
              <div className="location-section-header">
                <span className={`${DECISION_BADGE_CLASS[decision as Decision] ?? 'badge'}`}>
                  {label.en}
                </span>
                <span className="location-section-meta">{items.length} unboxed</span>
              </div>
              {items.map(e => (
                <div key={e.id} className="entry-row" style={{ cursor: 'default' }}>
                  <div className="entry-thumb">
                    {e.photo_data
                      ? <img src={`data:image/jpeg;base64,${e.photo_data}`} alt="" className="entry-thumb-img" />
                      : <span className="entry-thumb-placeholder">◻</span>}
                  </div>
                  <div className="entry-row-body">
                    <div className="entry-name">{e.item_name}</div>
                    {e.item_name_it && <div className="entry-name-it">{e.item_name_it}</div>}
                    {e.weight_lb != null && (
                      <div className="entry-meta">{e.weight_lb} lb</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── BoxCard ──────────────────────────────────────────────────────────────────

function BoxCard({ box, log, usDestination, onClick }: {
  box: Box
  log: Entry[]
  usDestination: string
  onClick: () => void
}) {
  const items = getBoxItems(log, box.id)
  const { total: weight, unknownCount } = getBoxWeight(log, box.id)
  const isSuitcase = box.box_type === 'suitcase'
  const weightLimit = isSuitcase ? (box.weight_limit_lb ?? 50) : 70
  const label = getDecisionLabel(box.destination, usDestination)
  const badgeClass = DECISION_BADGE_CLASS[box.destination] ?? 'badge'
  const pct = weight != null ? Math.min(100, (weight / weightLimit) * 100) : 0
  const color = weightColor(weight)

  return (
    <button className="box-card" onClick={onClick}>
      <div className="box-card-top">
        {isSuitcase && <span aria-label="Suitcase" style={{ fontSize: 16, lineHeight: 1, marginRight: 2 }}>🧳</span>}
        <span className="box-number">{box.box_number}</span>
        {isSuitcase && box.suitcase_class ? (
          <span className="suitcase-class-badge" style={{ marginLeft: 4 }}>
            {SUITCASE_CLASS_LABELS[box.suitcase_class as keyof typeof SUITCASE_CLASS_LABELS]?.en ?? box.suitcase_class}
          </span>
        ) : (
          <span className={`${badgeClass} box-dest-badge`}>{label.en.split('—').pop()?.trim()}</span>
        )}
        {box.closed_at && <span className="box-closed-badge">Closed</span>}
      </div>

      <div className="box-card-meta">
        {items.length} item{items.length !== 1 ? 's' : ''}
        {weight != null && (
          <> · <span style={{ color, fontWeight: 600 }}>{weightLabel(weight, unknownCount)}</span></>
        )}
        {weight == null && unknownCount > 0 && (
          <> · <span style={{ color: 'var(--ink-soft)' }}>? lb</span></>
        )}
        {isSuitcase && <> · <span className="ink-soft">{weightLimit} lb limit</span></>}
      </div>

      {/* Weight bar */}
      <div className="weight-bar-track">
        <div
          className="weight-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
        {pct > 100 && (
          <span className="weight-bar-limit" title={`Over ${weightLimit} lb limit`}>⚠</span>
        )}
      </div>
    </button>
  )
}

// ─── BoxDetailOverlay ─────────────────────────────────────────────────────────

function BoxDetailOverlay({ box, locations, log, usDestination, onClose, onSaved, onDeleted }: {
  box: Box
  locations: Location[]
  log: Entry[]
  usDestination: string
  onClose: () => void
  onSaved: (b: Box) => void
  onDeleted: (id: number) => void
}) {
  const items = getBoxItems(log, box.id)
  const { total: weight, unknownCount } = getBoxWeight(log, box.id)
  const label = getDecisionLabel(box.destination, usDestination)
  const badgeClass = DECISION_BADGE_CLASS[box.destination] ?? 'badge'

  const [locationId, setLocationId] = useState<number | null>(box.current_location_id)
  const [notes, setNotes] = useState(box.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('cernita_boxes')
      .update({ current_location_id: locationId, notes: notes || null })
      .eq('id', box.id)
      .select()
      .single()
    setSaving(false)
    if (err || !data) { setError('Save failed'); return }
    onSaved(data as Box)
  }

  async function handleToggleClose() {
    setSaving(true)
    const { data, error: err } = await supabase
      .from('cernita_boxes')
      .update({ closed_at: box.closed_at ? null : new Date().toISOString() })
      .eq('id', box.id)
      .select()
      .single()
    setSaving(false)
    if (!err && data) onSaved(data as Box)
  }

  async function handleDelete() {
    if (items.length > 0) { setError('Remove all items before deleting'); return }
    setSaving(true)
    const { error: err } = await supabase.from('cernita_boxes').delete().eq('id', box.id)
    setSaving(false)
    if (err) { setError('Delete failed'); return }
    onDeleted(box.id)
  }

  const pct = weight != null ? Math.min(100, (weight / 70) * 100) : 0
  const color = weightColor(weight)

  return (
    <div className="overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="detail-sheet">
        <div className="detail-header">
          <button className="detail-close" onClick={onClose}>✕</button>
        </div>

        <div className="detail-body">
          {/* Box number + destination */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span className="box-number-large">{box.box_number}</span>
            <span className={`${badgeClass} detail-badge`}>{label.en}</span>
            {box.closed_at && <span className="box-closed-badge">Closed</span>}
          </div>

          {/* Weight gauge */}
          <div className="weight-gauge">
            <div className="weight-gauge-track">
              <div className="weight-gauge-fill" style={{ width: `${pct}%`, background: color }} />
              <div className="weight-gauge-marker" style={{ left: `${(50/70)*100}%` }} title="50 lb soft limit" />
              <div className="weight-gauge-marker" style={{ left: '100%' }} title="70 lb hard limit" />
            </div>
            <div className="weight-gauge-labels">
              <span style={{ color, fontWeight: 700 }}>{weightLabel(weight, unknownCount)}</span>
              <span className="ink-soft" style={{ fontSize: 11 }}>70 lb limit</span>
            </div>
            {weight != null && weight > 70 && (
              <p className="weight-warning">⚠ Over 70 lb — consider splitting this box</p>
            )}
            {weight != null && weight > 50 && weight <= 70 && (
              <p className="weight-warning-soft">Heavy — two-person lift recommended</p>
            )}
          </div>

          {/* Location picker */}
          <label className="input-label" style={{ marginTop: 16 }}>Current location · Posizione</label>
          <select
            className="input"
            value={locationId ?? ''}
            onChange={e => setLocationId(e.target.value ? Number(e.target.value) : null)}
            style={{ marginBottom: 14 }}
          >
            <option value="">— Unassigned —</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>
                {l.name}{l.name_it && l.name_it !== l.name ? ` · ${l.name_it}` : ''}
              </option>
            ))}
          </select>

          {/* Notes */}
          <label className="input-label">Notes · Note</label>
          <textarea
            className="input"
            style={{ minHeight: 60, resize: 'vertical', marginBottom: 14 }}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Fragile — top of stack only"
          />

          {error && <p className="eval-error-text" style={{ marginBottom: 12 }}>{error}</p>}

          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ marginBottom: 10 }}>
            {saving ? 'Saving…' : 'Save · Salva'}
          </button>

          {/* Items in box */}
          {items.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p className="economics-label" style={{ marginBottom: 8 }}>
                Contents · Contenuto ({items.length})
              </p>
              {items.map(e => (
                <div key={e.id} className="box-item-row">
                  <span className="box-item-name">{e.item_name}</span>
                  {e.weight_lb != null && (
                    <span className="box-item-weight">{e.weight_lb} lb</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Close/open toggle */}
          <button
            className="btn-secondary"
            style={{ width: '100%', marginTop: 20 }}
            onClick={handleToggleClose}
            disabled={saving}
          >
            {box.closed_at ? 'Reopen box · Riapri' : 'Mark as closed · Chiudi scatola'}
          </button>

          {/* Delete */}
          {showDelete ? (
            <div className="delete-confirm" style={{ marginTop: 10 }}>
              <p className="delete-confirm-text">
                Delete <strong>{box.box_number}</strong>?
                {items.length > 0 && (
                  <span style={{ display: 'block', color: 'var(--terracotta)', fontSize: 13, marginTop: 4 }}>
                    Remove {items.length} item{items.length !== 1 ? 's' : ''} first.
                  </span>
                )}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowDelete(false)}>Cancel</button>
                <button className="btn-destructive" style={{ flex: 1 }} onClick={handleDelete} disabled={saving || items.length > 0}>Delete</button>
              </div>
            </div>
          ) : (
            <button className="btn-destructive" style={{ width: '100%', marginTop: 8 }} onClick={() => setShowDelete(true)}>
              Delete box · Elimina scatola
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── NewBoxOverlay ────────────────────────────────────────────────────────────

function NewBoxOverlay({ boxes, locations, usDestination, onClose, onCreated }: {
  boxes: Box[]
  locations: Location[]
  usDestination: string
  onClose: () => void
  onCreated: (b: Box) => void
}) {
  const [destination, setDestination] = useState<Decision>('KEEP-ITALY')
  const [locationId, setLocationId] = useState<number | null>(
    locations.find(l => l.name === 'Galesburg house')?.id ?? locations[0]?.id ?? null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const boxNumber = nextBoxNumber(boxes)

  async function handleCreate() {
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('cernita_boxes')
      .insert({
        box_number: boxNumber,
        destination,
        current_location_id: locationId,
      })
      .select()
      .single()

    setSaving(false)
    if (err || !data) {
      setError(err?.message ?? 'Create failed — try again')
      return
    }
    onCreated(data as Box)
  }

  return (
    <div className="overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="override-sheet">
        <h3 className="serif override-title">
          New box · Nuova scatola
          <span className="box-number" style={{ marginLeft: 12, fontSize: '0.7em' }}>{boxNumber}</span>
        </h3>

        <label className="input-label">Destination · Destinazione</label>
        <select
          className="input"
          value={destination}
          onChange={e => setDestination(e.target.value as Decision)}
          style={{ marginBottom: 14 }}
        >
          {VALID_DESTINATIONS.map(d => {
            const lbl = getDecisionLabel(d, usDestination)
            return <option key={d} value={d}>{lbl.en} · {lbl.it}</option>
          })}
        </select>

        <label className="input-label">Starting location · Posizione iniziale</label>
        <select
          className="input"
          value={locationId ?? ''}
          onChange={e => setLocationId(e.target.value ? Number(e.target.value) : null)}
          style={{ marginBottom: 20 }}
        >
          <option value="">— Unassigned —</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>
              {l.name}{l.name_it && l.name_it !== l.name ? ` · ${l.name_it}` : ''}
            </option>
          ))}
        </select>

        {error && <p className="eval-error-text" style={{ marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : `Create ${boxNumber}`}
          </button>
        </div>
      </div>
    </div>
  )
}
