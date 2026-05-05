import Head from 'next/head'
import { useState, useCallback } from 'react'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import SyncIndicator from '../components/SyncIndicator'
import { useApp } from '../lib/context'
import { supabase } from '../lib/supabase'
import haptic from '../lib/haptic'
import {
  Trip, TripStatus, Box, Entry, Location, Decision,
  TRIP_STATUS_LABELS, SUITCASE_CLASS_LABELS,
  DECISION_BADGE_CLASS, getDecisionLabel,
} from '../lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getSuitcases(boxes: Box[], tripId: number): Box[] {
  return boxes.filter(b => b.trip_id === tripId && b.box_type === 'suitcase')
}

function getSuitcaseItems(log: Entry[], suitcaseId: number): Entry[] {
  return log.filter(e => e.box_id === suitcaseId)
}

function getSuitcaseWeight(log: Entry[], suitcaseId: number): { total: number | null; unknownCount: number } {
  const items = getSuitcaseItems(log, suitcaseId)
  const known = items.filter(e => e.weight_lb != null)
  const unknownCount = items.length - known.length
  if (known.length === 0) return { total: null, unknownCount }
  return { total: known.reduce((s, e) => s + (e.weight_lb ?? 0), 0), unknownCount }
}

function weightColor(lb: number, limit: number): string {
  const pct = lb / limit
  if (pct <= 0.6) return 'var(--olive)'
  if (pct <= 0.85) return 'var(--gold)'
  if (pct <= 1.0) return 'var(--terracotta)'
  return '#8b1a00'
}

function locationName(locations: Location[], id: number | null): string {
  if (!id) return '—'
  return locations.find(l => l.id === id)?.name ?? '—'
}

function isUpcoming(trip: Trip): boolean {
  return trip.status === 'planned' || trip.status === 'packing'
}

function statusBadgeClass(status: TripStatus): string {
  switch (status) {
    case 'planned':  return 'trip-status-pill trip-status-planned'
    case 'packing':  return 'trip-status-pill trip-status-packing'
    case 'executed': return 'trip-status-pill trip-status-executed'
    case 'canceled': return 'trip-status-pill trip-status-canceled'
  }
}

const SUITCASE_CLASSES = ['checked', 'carry_on', 'personal_item'] as const

const VALID_DESTINATIONS: Decision[] = [
  'KEEP-ITALY', 'KEEP-US', 'SELL', 'DONATE', 'DISPOSE', 'GIVE-FAMILY',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TripsPage() {
  const { state, dispatch } = useApp()
  const { trips, boxes, locations, log, settings } = state

  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [showNewTrip, setShowNewTrip] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  const upcoming = trips.filter(isUpcoming).sort((a, b) => {
    if (!a.departure_date) return 1
    if (!b.departure_date) return -1
    return a.departure_date.localeCompare(b.departure_date)
  })
  const past = trips.filter(t => !isUpcoming(t)).sort((a, b) => {
    const aTime = a.executed_at ?? a.created_at
    const bTime = b.executed_at ?? b.created_at
    return bTime.localeCompare(aTime)
  })

  // Keep selected trip in sync with realtime
  const liveSelectedTrip = selectedTrip
    ? (trips.find(t => t.id === selectedTrip.id) ?? selectedTrip)
    : null

  return (
    <AuthGuard>
      <Head><title>Cernita — Trips</title></Head>
      <div className="app-shell">

        <header className="trips-header">
          <span className="serif" style={{ fontSize: '20px' }}>Trips · <em className="ink-soft" style={{ fontStyle: 'italic', fontSize: '16px' }}>Viaggi</em></span>
          <SyncIndicator />
        </header>

        {toast && <div className="toast">{toast}</div>}

        <div className="page-content">

          <button className="btn-primary" style={{ marginBottom: 24 }} onClick={() => setShowNewTrip(true)}>
            + New trip · Nuovo viaggio
          </button>

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="trips-section">
              <h3 className="trips-section-title">Upcoming · <em>In programma</em></h3>
              {upcoming.map(trip => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  boxes={boxes}
                  log={log}
                  locations={locations}
                  onClick={() => setSelectedTrip(trip)}
                />
              ))}
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div className="trips-section">
              <h3 className="trips-section-title">Past · <em>Passati</em></h3>
              {past.map(trip => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  boxes={boxes}
                  log={log}
                  locations={locations}
                  onClick={() => setSelectedTrip(trip)}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {trips.length === 0 && (
            <div className="empty-state">
              <div style={{ fontSize: 36, marginBottom: 12 }}>✈</div>
              <h3>No trips yet</h3>
              <p className="italic ink-soft">Nessun viaggio ancora pianificato.</p>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 8 }}>
                Plan a trip to track items going via suitcase.
              </p>
            </div>
          )}
        </div>

        {/* Trip detail overlay */}
        {liveSelectedTrip && (
          <TripDetailOverlay
            trip={liveSelectedTrip}
            boxes={boxes}
            locations={locations}
            log={log}
            settings={settings}
            onClose={() => setSelectedTrip(null)}
            onSaved={(t) => { dispatch({ type: 'UPSERT_TRIP', trip: t }); showToast('Saved · Salvato') }}
            onBoxSaved={(b) => dispatch({ type: 'UPSERT_BOX', box: b })}
            onBoxDeleted={(id) => dispatch({ type: 'DELETE_BOX', id })}
            onDeleted={(id) => { dispatch({ type: 'DELETE_TRIP', id }); setSelectedTrip(null); showToast('Trip deleted · Viaggio eliminato') }}
            showToast={showToast}
          />
        )}

        {/* New trip overlay */}
        {showNewTrip && (
          <NewTripOverlay
            locations={locations}
            onClose={() => setShowNewTrip(false)}
            onCreated={(t) => {
              dispatch({ type: 'UPSERT_TRIP', trip: t })
              setShowNewTrip(false)
              showToast(`${t.name} created · Creato`)
            }}
          />
        )}

        <Nav />
      </div>
    </AuthGuard>
  )
}

// ─── TripCard ─────────────────────────────────────────────────────────────────

function TripCard({ trip, boxes, log, locations, onClick }: {
  trip: Trip
  boxes: Box[]
  log: Entry[]
  locations: Location[]
  onClick: () => void
}) {
  const suitcases = getSuitcases(boxes, trip.id)
  const totalWeight = suitcases.reduce((sum, s) => {
    const { total } = getSuitcaseWeight(log, s.id)
    return sum + (total ?? 0)
  }, 0)
  const overweightCount = suitcases.filter(s => {
    const { total } = getSuitcaseWeight(log, s.id)
    const limit = s.weight_limit_lb ?? 50
    return total != null && total > limit
  }).length
  const itemCount = suitcases.reduce((sum, s) => sum + getSuitcaseItems(log, s.id).length, 0)
  const labels = TRIP_STATUS_LABELS[trip.status]

  return (
    <button className="trip-card" onClick={onClick}>
      <div className="trip-card-top">
        <div className="trip-card-name">
          <span className="trip-name">{trip.name}</span>
          {trip.name_it && <em className="trip-name-it"> · {trip.name_it}</em>}
        </div>
        <span className={statusBadgeClass(trip.status)}>{labels.en}</span>
      </div>

      <div className="trip-route">
        <span>{locationName(locations, trip.origin_location_id)}</span>
        <span className="trip-route-arrow"> → </span>
        <span>{locationName(locations, trip.destination_location_id)}</span>
      </div>

      <div className="trip-card-meta">
        <span>{trip.traveler_name}</span>
        {trip.departure_date && <span> · {fmtDate(trip.departure_date)}</span>}
        {suitcases.length > 0 && (
          <span> · {suitcases.length} bag{suitcases.length !== 1 ? 's' : ''}, {itemCount} item{itemCount !== 1 ? 's' : ''}</span>
        )}
        {totalWeight > 0 && <span> · ~{totalWeight.toFixed(0)} lb</span>}
      </div>

      {overweightCount > 0 && (
        <p className="trip-overweight-warning">⚠ {overweightCount} bag{overweightCount !== 1 ? 's' : ''} overweight</p>
      )}
    </button>
  )
}

// ─── TripDetailOverlay ────────────────────────────────────────────────────────

function TripDetailOverlay({ trip, boxes, locations, log, settings, onClose, onSaved, onBoxSaved, onBoxDeleted, onDeleted, showToast }: {
  trip: Trip
  boxes: Box[]
  locations: Location[]
  log: Entry[]
  settings: ReturnType<typeof useApp>['state']['settings']
  onClose: () => void
  onSaved: (t: Trip) => void
  onBoxSaved: (b: Box) => void
  onBoxDeleted: (id: number) => void
  onDeleted: (id: number) => void
  showToast: (msg: string) => void
}) {
  const suitcases = getSuitcases(boxes, trip.id)
  const isLocked = trip.status === 'executed' || trip.status === 'canceled'
  const isExecuted = trip.status === 'executed'
  const isCanceled = trip.status === 'canceled'

  const [showAddSuitcase, setShowAddSuitcase] = useState(false)
  const [showExecuteConfirm, setShowExecuteConfirm] = useState(false)
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Edit state
  const [editNotes, setEditNotes] = useState(trip.notes ?? '')
  const [editNotesIt, setEditNotesIt] = useState(trip.notes_it ?? '')

  async function handleStatusChange(newStatus: TripStatus, extra?: Partial<Trip>) {
    setSaving(true)
    const { data, error: err } = await supabase
      .from('cernita_trips')
      .update({ status: newStatus, ...extra })
      .eq('id', trip.id)
      .select()
      .single()
    setSaving(false)
    if (err || !data) { setError('Save failed — try again'); return }
    onSaved(data as Trip)
    setShowExecuteConfirm(false)
    setShowReopenConfirm(false)
    setShowCancelConfirm(false)
  }

  async function handleExecute() {
    setSaving(true)
    // Move all suitcases to trip destination
    for (const s of suitcases) {
      const { data } = await supabase
        .from('cernita_boxes')
        .update({ current_location_id: trip.destination_location_id })
        .eq('id', s.id)
        .select()
        .single()
      if (data) onBoxSaved(data as Box)
    }
    await handleStatusChange('executed', { executed_at: new Date().toISOString() })
    haptic.celebrate()
    showToast(`Trip executed · ${suitcases.length} bag${suitcases.length !== 1 ? 's' : ''} moved`)
  }

  async function handleReopen() {
    await handleStatusChange('packing', { executed_at: null } as Partial<Trip>)
    setShowReopenConfirm(false)
  }

  async function handleCancel() {
    // Unassign suitcases from trip (revert to plastic boxes)
    setSaving(true)
    for (const s of suitcases) {
      const { data } = await supabase
        .from('cernita_boxes')
        .update({ trip_id: null, box_type: 'plastic', suitcase_class: null })
        .eq('id', s.id)
        .select()
        .single()
      if (data) onBoxSaved(data as Box)
    }
    await handleStatusChange('canceled')
    showToast('Trip canceled · Viaggio annullato')
  }

  async function handleSaveNotes() {
    setSaving(true)
    const { data, error: err } = await supabase
      .from('cernita_trips')
      .update({ notes: editNotes || null, notes_it: editNotesIt || null })
      .eq('id', trip.id)
      .select()
      .single()
    setSaving(false)
    if (!err && data) onSaved(data as Trip)
  }

  async function handleDelete() {
    setSaving(true)
    const { error: err } = await supabase.from('cernita_trips').delete().eq('id', trip.id)
    setSaving(false)
    if (err) { setError('Delete failed'); return }
    onDeleted(trip.id)
  }

  const totalItems = suitcases.reduce((sum, s) => sum + getSuitcaseItems(log, s.id).length, 0)
  const labels = TRIP_STATUS_LABELS[trip.status]

  return (
    <div className="overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="detail-sheet">
        <div className="detail-header">
          <button className="detail-close" onClick={onClose}>✕</button>
        </div>

        <div className="detail-body">

          {/* Lock banner */}
          {isExecuted && (
            <div className="trip-lock-banner">
              🔒 Executed {trip.executed_at ? fmtDate(trip.executed_at) : ''} · Completato
              {!isCanceled && (
                <button className="trip-reopen-link" onClick={() => setShowReopenConfirm(true)}>
                  Reopen · Riapri
                </button>
              )}
            </div>
          )}
          {isCanceled && (
            <div className="trip-lock-banner trip-lock-canceled">
              ✕ Canceled · Annullato
            </div>
          )}

          {/* Trip header */}
          <div className="trip-detail-name-row">
            <h2 className="serif" style={{ fontSize: 24, fontWeight: 400, marginBottom: 4 }}>
              {trip.name}
              {trip.name_it && <em className="detail-name-it"> · {trip.name_it}</em>}
            </h2>
            <span className={statusBadgeClass(trip.status)}>{labels.en} · <em>{labels.it}</em></span>
          </div>

          <div className="trip-detail-meta">
            <div className="trip-route" style={{ marginBottom: 4 }}>
              <span>{locationName(locations, trip.origin_location_id)}</span>
              <span className="trip-route-arrow"> → </span>
              <span>{locationName(locations, trip.destination_location_id)}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              {trip.traveler_name}
              {trip.departure_date && ` · ${fmtDate(trip.departure_date)}`}
              {trip.return_date && ` → ${fmtDate(trip.return_date)}`}
            </p>
          </div>

          {/* Suitcases */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p className="economics-label">Bags · Borse ({suitcases.length})</p>
              {!isLocked && (
                <button
                  className="btn-link"
                  style={{ fontSize: 12 }}
                  onClick={() => setShowAddSuitcase(true)}
                >
                  + Add bag
                </button>
              )}
            </div>

            {suitcases.length === 0 ? (
              <p className="ink-soft" style={{ fontSize: 13, fontStyle: 'italic', marginBottom: 16 }}>
                No bags yet — add a suitcase to start packing.
              </p>
            ) : (
              suitcases.map(s => (
                <SuitcaseCard
                  key={s.id}
                  suitcase={s}
                  log={log}
                  settings={settings}
                  isLocked={isLocked}
                  onSaved={onBoxSaved}
                  onDeleted={onBoxDeleted}
                />
              ))
            )}
          </div>

          {/* Notes */}
          {!isLocked ? (
            <div style={{ marginTop: 16 }}>
              <label className="input-label">Notes · Note</label>
              <textarea
                className="input"
                style={{ minHeight: 56, resize: 'vertical', marginBottom: 8 }}
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="e.g. Ship books ahead via FedEx"
              />
              <textarea
                className="input"
                style={{ minHeight: 48, resize: 'vertical', marginBottom: 10 }}
                value={editNotesIt}
                onChange={e => setEditNotesIt(e.target.value)}
                placeholder="Note in italiano (opzionale)"
              />
              <button className="btn-secondary" style={{ width: '100%', fontSize: 13 }} onClick={handleSaveNotes} disabled={saving}>
                Save notes · Salva note
              </button>
            </div>
          ) : (
            trip.notes && (
              <div className="override-note" style={{ marginTop: 16 }}>
                <span className="override-note-label">Notes · Note</span>
                <p className="override-note-text">{trip.notes}</p>
                {trip.notes_it && <p className="override-note-text italic" style={{ color: 'var(--ink-soft)' }}>{trip.notes_it}</p>}
              </div>
            )
          )}

          {error && <p className="eval-error-text" style={{ marginTop: 12 }}>{error}</p>}

          {/* Status actions */}
          {!isLocked && (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trip.status === 'planned' && (
                <button className="btn-secondary" style={{ width: '100%' }} onClick={() => handleStatusChange('packing')} disabled={saving}>
                  Mark as packing · In preparazione
                </button>
              )}
              {(trip.status === 'planned' || trip.status === 'packing') && (
                <button className="btn-primary" onClick={() => setShowExecuteConfirm(true)} disabled={saving}>
                  Mark as executed · Segna completato
                </button>
              )}
              {!isCanceled && (
                <button className="btn-destructive" style={{ width: '100%' }} onClick={() => setShowCancelConfirm(true)} disabled={saving}>
                  Cancel trip · Annulla viaggio
                </button>
              )}
            </div>
          )}

          {isExecuted && (
            <div style={{ marginTop: 20 }}>
              <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setShowReopenConfirm(true)} disabled={saving}>
                Reopen trip · Riapri viaggio
              </button>
            </div>
          )}

          {/* Execute confirmation */}
          {showExecuteConfirm && (
            <div className="delete-confirm" style={{ marginTop: 12 }}>
              <p className="delete-confirm-text">
                Mark <strong>{trip.name}</strong> as executed?
                <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                  This will move {totalItems} item{totalItems !== 1 ? 's' : ''} in {suitcases.length} bag{suitcases.length !== 1 ? 's' : ''} to{' '}
                  <strong>{locationName(locations, trip.destination_location_id)}</strong> and lock the manifest.
                </span>
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowExecuteConfirm(false)} disabled={saving}>Cancel</button>
                <button className="btn-primary" style={{ flex: 2 }} onClick={handleExecute} disabled={saving}>
                  {saving ? 'Executing…' : 'Mark executed · Conferma'}
                </button>
              </div>
            </div>
          )}

          {/* Reopen confirmation */}
          {showReopenConfirm && (
            <div className="delete-confirm" style={{ marginTop: 12 }}>
              <p className="delete-confirm-text">
                Reopen <strong>{trip.name}</strong>?
                <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                  Use only to fix mistakes — items have already physically moved. Locations will not roll back.
                </span>
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowReopenConfirm(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 2 }} onClick={handleReopen} disabled={saving}>
                  {saving ? 'Reopening…' : 'Reopen · Riapri'}
                </button>
              </div>
            </div>
          )}

          {/* Cancel confirmation */}
          {showCancelConfirm && (
            <div className="delete-confirm" style={{ marginTop: 12 }}>
              <p className="delete-confirm-text">
                Cancel <strong>{trip.name}</strong>?
                <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                  Bags will revert to unpacked plastic boxes. Items stay in their boxes.
                </span>
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCancelConfirm(false)}>Keep it</button>
                <button className="btn-destructive" style={{ flex: 1 }} onClick={handleCancel} disabled={saving}>
                  {saving ? 'Canceling…' : 'Cancel trip'}
                </button>
              </div>
            </div>
          )}

          {/* Delete (only for canceled trips) */}
          {isCanceled && (
            showDelete ? (
              <div className="delete-confirm" style={{ marginTop: 12 }}>
                <p className="delete-confirm-text">Delete <strong>{trip.name}</strong>? This cannot be undone.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowDelete(false)}>Keep it</button>
                  <button className="btn-destructive" style={{ flex: 1 }} onClick={handleDelete} disabled={saving}>Delete</button>
                </div>
              </div>
            ) : (
              <button className="btn-destructive" style={{ width: '100%', marginTop: 10 }} onClick={() => setShowDelete(true)}>
                Delete trip · Elimina viaggio
              </button>
            )
          )}
        </div>

        {/* Add suitcase sheet */}
        {showAddSuitcase && (
          <AddSuitcaseOverlay
            trip={trip}
            boxes={boxes}
            settings={settings}
            usDestination={settings.usDestination}
            onClose={() => setShowAddSuitcase(false)}
            onCreated={(b) => { onBoxSaved(b); setShowAddSuitcase(false); showToast(`${b.box_number} added`) }}
          />
        )}
      </div>
    </div>
  )
}

// ─── SuitcaseCard ─────────────────────────────────────────────────────────────

function SuitcaseCard({ suitcase, log, settings, isLocked, onSaved, onDeleted }: {
  suitcase: Box
  log: Entry[]
  settings: ReturnType<typeof useApp>['state']['settings']
  isLocked: boolean
  onSaved: (b: Box) => void
  onDeleted: (id: number) => void
}) {
  const items = getSuitcaseItems(log, suitcase.id)
  const { total: weight, unknownCount } = getSuitcaseWeight(log, suitcase.id)
  const classKey = suitcase.suitcase_class ?? 'checked'
  const classLabel = SUITCASE_CLASS_LABELS[classKey as keyof typeof SUITCASE_CLASS_LABELS]
  const limit = suitcase.weight_limit_lb ?? 50
  const pct = weight != null ? Math.min(100, (weight / limit) * 100) : 0
  const color = weight != null ? weightColor(weight, limit) : 'var(--ink-soft)'
  const [showDelete, setShowDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleDelete() {
    if (items.length > 0) return
    setSaving(true)
    const { error } = await supabase.from('cernita_boxes').delete().eq('id', suitcase.id)
    setSaving(false)
    if (!error) onDeleted(suitcase.id)
  }

  return (
    <div className="suitcase-card">
      <div className="suitcase-card-top">
        <span className="suitcase-icon">🧳</span>
        <div style={{ flex: 1 }}>
          <span className="box-number" style={{ marginRight: 8 }}>{suitcase.box_number}</span>
          <span className="suitcase-class-badge">{classLabel.en} · <em>{classLabel.it}</em></span>
        </div>
        {weight != null && weight > limit && <span style={{ color: 'var(--terracotta)', fontSize: 12, fontWeight: 700 }}>⚠ Over limit</span>}
      </div>

      {/* Weight gauge */}
      <div className="weight-gauge" style={{ marginBottom: 8 }}>
        <div className="weight-gauge-track">
          <div className="weight-gauge-fill" style={{ width: `${pct}%`, background: color }} />
          <div className="weight-gauge-marker" style={{ left: '100%' }} />
        </div>
        <div className="weight-gauge-labels">
          <span style={{ color, fontWeight: 600, fontSize: 12 }}>
            {weight != null ? `${weight.toFixed(1)} lb` : '— lb'}
            {unknownCount > 0 && ` (+${unknownCount} unknown)`}
          </span>
          <span className="ink-soft" style={{ fontSize: 11 }}>{limit} lb limit</span>
        </div>
      </div>

      {/* Items */}
      {items.length > 0 ? (
        <div style={{ marginBottom: 8 }}>
          <p className="economics-label" style={{ marginBottom: 4 }}>Contents ({items.length})</p>
          {items.map(e => (
            <div key={e.id} className="box-item-row">
              <span className="box-item-name">{e.item_name}</span>
              {e.weight_lb != null && <span className="box-item-weight">{e.weight_lb} lb</span>}
            </div>
          ))}
        </div>
      ) : (
        <p className="ink-soft" style={{ fontSize: 12, fontStyle: 'italic', marginBottom: 8 }}>
          Empty — assign items from the Log tab.
        </p>
      )}

      {/* Delete (only if empty and not locked) */}
      {!isLocked && items.length === 0 && (
        showDelete ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn-secondary" style={{ flex: 1, fontSize: 12, padding: '6px' }} onClick={() => setShowDelete(false)}>Keep</button>
            <button className="btn-destructive" style={{ flex: 1, fontSize: 12, padding: '6px' }} onClick={handleDelete} disabled={saving}>
              {saving ? '…' : 'Delete bag'}
            </button>
          </div>
        ) : (
          <button className="btn-link" style={{ fontSize: 11, color: 'var(--ink-soft)' }} onClick={() => setShowDelete(true)}>
            Remove empty bag
          </button>
        )
      )}
    </div>
  )
}

// ─── AddSuitcaseOverlay ───────────────────────────────────────────────────────

function AddSuitcaseOverlay({ trip, boxes, settings, usDestination, onClose, onCreated }: {
  trip: Trip
  boxes: Box[]
  settings: ReturnType<typeof useApp>['state']['settings']
  usDestination: string
  onClose: () => void
  onCreated: (b: Box) => void
}) {
  const [suitcaseClass, setSuitcaseClass] = useState<'checked' | 'carry_on' | 'personal_item'>('checked')
  const [destination, setDestination] = useState<Decision>('KEEP-ITALY')
  const [weightLimit, setWeightLimit] = useState<number>(settings.checkedBagLimitLb)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Update weight limit default when class changes
  function handleClassChange(c: typeof suitcaseClass) {
    setSuitcaseClass(c)
    if (c === 'checked')       setWeightLimit(settings.checkedBagLimitLb)
    if (c === 'carry_on')      setWeightLimit(settings.carryOnLimitLb)
    if (c === 'personal_item') setWeightLimit(settings.personalItemLimitLb)
  }

  // Auto-generate next box number
  function nextBoxNumber(): string {
    const nums = boxes
      .map(b => parseInt(b.box_number.replace('BOX-', ''), 10))
      .filter(n => !isNaN(n))
    const max = nums.length > 0 ? Math.max(...nums) : 0
    return `BOX-${String(max + 1).padStart(3, '0')}`
  }

  async function handleCreate() {
    setSaving(true)
    setError('')
    const boxNumber = nextBoxNumber()
    const { data, error: err } = await supabase
      .from('cernita_boxes')
      .insert({
        box_number: boxNumber,
        destination,
        box_type: 'suitcase',
        trip_id: trip.id,
        suitcase_class: suitcaseClass,
        weight_limit_lb: weightLimit,
        current_location_id: trip.origin_location_id,
      })
      .select()
      .single()
    setSaving(false)
    if (err || !data) { setError(err?.message ?? 'Create failed'); return }
    onCreated(data as Box)
  }

  const classLabel = SUITCASE_CLASS_LABELS[suitcaseClass]

  return (
    <div className="overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="override-sheet">
        <h3 className="serif override-title">
          🧳 Add bag · Aggiungi borsa
        </h3>

        <label className="input-label">Bag type · Tipo di borsa</label>
        <select
          className="input"
          value={suitcaseClass}
          onChange={e => handleClassChange(e.target.value as typeof suitcaseClass)}
          style={{ marginBottom: 14 }}
        >
          {SUITCASE_CLASSES.map(c => {
            const lbl = SUITCASE_CLASS_LABELS[c]
            return <option key={c} value={c}>{lbl.en} · {lbl.it}</option>
          })}
        </select>

        <label className="input-label">Weight limit (lb) · Limite peso</label>
        <input
          type="number"
          className="input"
          min={1}
          step={0.5}
          value={weightLimit}
          onChange={e => setWeightLimit(parseFloat(e.target.value) || 50)}
          style={{ marginBottom: 14 }}
        />

        <label className="input-label">Contents destination · Destinazione contenuto</label>
        <select
          className="input"
          value={destination}
          onChange={e => setDestination(e.target.value as Decision)}
          style={{ marginBottom: 20 }}
        >
          {VALID_DESTINATIONS.map(d => {
            const lbl = getDecisionLabel(d, usDestination)
            return <option key={d} value={d}>{lbl.en} · {lbl.it}</option>
          })}
        </select>

        {error && <p className="eval-error-text" style={{ marginBottom: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={handleCreate} disabled={saving}>
            {saving ? 'Adding…' : `Add ${classLabel.en} · Aggiungi`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── NewTripOverlay ────────────────────────────────────────────────────────────

function NewTripOverlay({ locations, onClose, onCreated }: {
  locations: Location[]
  onClose: () => void
  onCreated: (t: Trip) => void
}) {
  const [name, setName] = useState('')
  const [nameIt, setNameIt] = useState('')
  const [traveler, setTraveler] = useState('')
  const [originId, setOriginId] = useState<number | ''>(locations[0]?.id ?? '')
  const [destId, setDestId] = useState<number | ''>('')
  const [departureDate, setDepartureDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) { setError('Trip name is required'); return }
    if (!traveler.trim()) { setError('Traveler name is required'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('cernita_trips')
      .insert({
        name: name.trim(),
        name_it: nameIt.trim() || null,
        traveler_name: traveler.trim(),
        origin_location_id: originId || null,
        destination_location_id: destId || null,
        departure_date: departureDate || null,
        return_date: returnDate || null,
        notes: notes.trim() || null,
        status: 'planned',
      })
      .select()
      .single()
    setSaving(false)
    if (err || !data) { setError(err?.message ?? 'Create failed — try again'); return }
    onCreated(data as Trip)
  }

  return (
    <div className="overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="override-sheet" style={{ maxHeight: '88vh', overflowY: 'auto' }}>
        <h3 className="serif override-title">New trip · Nuovo viaggio</h3>

        <label className="input-label">Trip name (English)</label>
        <input className="input" style={{ marginBottom: 10 }} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. June 2026 Doetinchem" />

        <label className="input-label">Nome del viaggio (Italiano — opzionale)</label>
        <input className="input" style={{ marginBottom: 14 }} value={nameIt} onChange={e => setNameIt(e.target.value)} placeholder="es. Giugno 2026 Doetinchem" />

        <label className="input-label">Traveler · Viaggiatore</label>
        <input className="input" style={{ marginBottom: 14 }} value={traveler} onChange={e => setTraveler(e.target.value)} placeholder="e.g. Marco, Elena, Both" />

        <label className="input-label">From · Da</label>
        <select className="input" style={{ marginBottom: 10 }} value={originId} onChange={e => setOriginId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">— Unknown —</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        <label className="input-label">To · A</label>
        <select className="input" style={{ marginBottom: 14 }} value={destId} onChange={e => setDestId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">— Unknown —</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        <label className="input-label">Departure date · Data di partenza</label>
        <input type="date" className="input" style={{ marginBottom: 10 }} value={departureDate} onChange={e => setDepartureDate(e.target.value)} />

        <label className="input-label">Return date (optional) · Ritorno</label>
        <input type="date" className="input" style={{ marginBottom: 14 }} value={returnDate} onChange={e => setReturnDate(e.target.value)} />

        <label className="input-label">Notes (optional) · Note</label>
        <textarea className="input" style={{ minHeight: 56, resize: 'vertical', marginBottom: 20 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Bringing family photos and books" />

        {error && <p className="eval-error-text" style={{ marginBottom: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create trip · Crea viaggio'}
          </button>
        </div>
      </div>
    </div>
  )
}
