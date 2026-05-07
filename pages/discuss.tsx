import Head from 'next/head'
import { useState, useCallback } from 'react'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import SyncIndicator from '../components/SyncIndicator'
import { useApp } from '../lib/context'
import { supabase } from '../lib/supabase'
import haptic from '../lib/haptic'
import {
  Entry, Decision, DECISION_LABELS, DECISION_BADGE_CLASS, getDecisionLabel, CernitaSettings,
} from '../lib/types'
import { computePerspectives, DualPerspective } from '../lib/perspectives'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return `$${Math.abs(n).toFixed(0)}`
}

const RESOLVE_OPTIONS: Decision[] = [
  'SHIP-ITALY', 'SELL', 'DONATE', 'DISPOSE', 'GIVE-FAMILY', 'CONSUME',
]

// ─── Discussion card ──────────────────────────────────────────────────────────

function DiscussCard({
  entry,
  usDestination,
  settings,
  onResolved,
}: {
  entry: Entry
  usDestination: string
  settings: CernitaSettings
  onResolved: (entry: Entry) => void
}) {
  const [resolving, setResolving] = useState(false)
  const [selectedDecision, setSelectedDecision] = useState<Decision>('SHIP-ITALY')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleResolve() {
    setSaving(true)
    setError('')
    const { data, error: err } = await supabase
      .from('cernita_entries')
      .update({
        final_decision: selectedDecision,
        override_reason: `Resolved from NEEDS-HUMAN discussion`,
        user_confirmed: true,
      })
      .eq('id', entry.id)
      .select()
      .single()

    setSaving(false)
    if (err || !data) {
      setError('Failed to save — try again.')
      return
    }

    haptic.confirm()
    onResolved(data as Entry)
  }

  const value = entry.replacement_cost ?? entry.estimated_resale_value

  return (
    <div className="discuss-card">
      {/* Photo + header */}
      <div className="discuss-header">
        {entry.photo_data ? (
          <img
            src={`data:image/jpeg;base64,${entry.photo_data}`}
            alt=""
            className="discuss-photo"
          />
        ) : (
          <div className="discuss-photo-empty">◻</div>
        )}
        <div className="discuss-header-text">
          <h3 className="discuss-item-name serif">{entry.item_name}</h3>
          {entry.item_name_it && (
            <p className="discuss-item-name-it italic">{entry.item_name_it}</p>
          )}
          {entry.item_model && (
            <p className="discuss-item-model">{entry.item_model}</p>
          )}
          <div className="discuss-meta">
            {value != null && <span>Value: {fmt(value)}</span>}
            {entry.ship_cost != null && <span>Ship: {fmt(entry.ship_cost)}</span>}
            {entry.weight_lb != null && <span>{entry.weight_lb} lb</span>}
          </div>
        </div>
      </div>

      {/* Flags */}
      <div className="discuss-flags">
        {entry.voltage_incompatible && (
          <span className="discuss-flag discuss-flag-voltage">⚡ 110V only</span>
        )}
        {entry.oversized && (
          <span className="discuss-flag discuss-flag-oversized">◱ Oversized</span>
        )}
        {entry.shipping_restriction === 'prohibited' && (
          <span className="discuss-flag discuss-flag-hazmat">🚫 Cannot ship</span>
        )}
        {entry.shipping_restriction === 'restricted' && (
          <span className="discuss-flag discuss-flag-warn">⚠️ Restricted</span>
        )}
        {entry.fragility && entry.fragility !== 'none' && (
          <span className="discuss-flag">Fragility: {entry.fragility}</span>
        )}
      </div>

      {/* Dual perspectives */}
      {(() => {
        const dual = computePerspectives(entry.net_cost_ship, entry.replacement_cost, settings)
        if (!dual.hasData) return null
        return (
          <div className="discuss-perspectives">
            <p className="discuss-rationale-label">Perspectives · Prospettive</p>
            <div className="perspectives-grid">
              <div className={`perspective-card perspective-${dual.ship.decision.toLowerCase()}`}>
                <p className="perspective-lens">{dual.ship.label.en}</p>
                <span className={`perspective-verdict perspective-verdict-${dual.ship.decision.toLowerCase()}`}>
                  {dual.ship.decision === 'SHIP-ITALY' ? '📦 Ship' : dual.ship.decision === 'SELL' ? '💰 Sell' : '⚖ Neutral'}
                </span>
                <p className="perspective-reason">{dual.ship.reason.en}</p>
              </div>
              <div className={`perspective-card perspective-${dual.save.decision.toLowerCase()}`}>
                <p className="perspective-lens">{dual.save.label.en}</p>
                <span className={`perspective-verdict perspective-verdict-${dual.save.decision.toLowerCase()}`}>
                  {dual.save.decision === 'SHIP-ITALY' ? '📦 Ship' : dual.save.decision === 'SELL' ? '💰 Sell' : '⚖ Neutral'}
                </span>
                <p className="perspective-reason">{dual.save.reason.en}</p>
              </div>
            </div>
            {!dual.agree && (
              <div className="perspectives-agreement disagree">
                <span className="agreement-icon">⚡</span>
                <span className="agreement-text">
                  Perspectives disagree — this is why it needs discussion
                </span>
              </div>
            )}
          </div>
        )
      })()}

      {/* AI rationale */}
      {entry.recommendation_rationale && (
        <div className="discuss-rationale">
          <p className="discuss-rationale-label">AI rationale · Motivazione AI</p>
          <p className="discuss-rationale-text">{entry.recommendation_rationale}</p>
          {entry.recommendation_rationale_it && (
            <p className="discuss-rationale-text italic ink-soft" style={{ marginTop: 6 }}>
              {entry.recommendation_rationale_it}
            </p>
          )}
        </div>
      )}

      {/* Evaluated by + date */}
      <p className="discuss-eval-info">
        Evaluated by <strong>{entry.user_name}</strong>
        {' · '}
        {new Date(entry.created_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })}
      </p>

      {/* Resolve section */}
      {resolving ? (
        <div className="discuss-resolve">
          <p className="discuss-resolve-label">Resolve as · Risolvi come</p>
          <select
            className="input"
            value={selectedDecision}
            onChange={e => setSelectedDecision(e.target.value as Decision)}
            style={{ marginBottom: 10 }}
          >
            {RESOLVE_OPTIONS.map(d => {
              const lbl = getDecisionLabel(d, usDestination)
              return (
                <option key={d} value={d}>{lbl.en} · {lbl.it}</option>
              )
            })}
          </select>
          {error && <p className="eval-error-text" style={{ marginBottom: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setResolving(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              style={{ flex: 2 }}
              onClick={handleResolve}
              disabled={saving}
            >
              {saving ? 'Saving…' : `Resolve → ${getDecisionLabel(selectedDecision, usDestination).en}`}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-primary"
          style={{ width: '100%', marginTop: 12 }}
          onClick={() => setResolving(true)}
        >
          Resolve this item · Risolvi
        </button>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DiscussPage() {
  const { state, dispatch } = useApp()
  const { log: entries, settings } = state

  const needsHuman = entries.filter(e => e.final_decision === 'NEEDS-HUMAN')
  const resolved = entries.filter(e =>
    e.override_reason?.includes('Resolved from NEEDS-HUMAN')
  ).length

  const handleResolved = useCallback((entry: Entry) => {
    dispatch({ type: 'UPSERT_ENTRY', entry })
  }, [dispatch])

  return (
    <AuthGuard>
      <Head><title>Cernita — Discuss</title></Head>
      <div className="app-shell">
        <header style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--paper-dark)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span className="serif" style={{ fontSize: '20px' }}>
            Discuss · <em className="ink-soft" style={{ fontStyle: 'italic', fontSize: '16px' }}>Discutere</em>
          </span>
          <SyncIndicator />
        </header>

        <div className="page-content">
          {needsHuman.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
              <h3>No items need discussion</h3>
              <p className="italic ink-soft">
                Nessun oggetto da discutere.
                {resolved > 0 && (
                  <span style={{ display: 'block', marginTop: 6 }}>
                    {resolved} item{resolved !== 1 ? 's' : ''} previously resolved.
                  </span>
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="discuss-intro">
                <p>
                  <strong>{needsHuman.length}</strong> item{needsHuman.length !== 1 ? 's' : ''} need
                  a decision from both of you. Review each and choose a destination.
                </p>
                <p className="italic ink-soft" style={{ marginTop: 4 }}>
                  {needsHuman.length} oggett{needsHuman.length === 1 ? 'o richiede' : 'i richiedono'} una
                  decisione condivisa. Esaminate e scegliete una destinazione.
                </p>
              </div>

              <div className="discuss-list">
                {needsHuman.map(entry => (
                  <DiscussCard
                    key={entry.id}
                    entry={entry}
                    usDestination={settings.usDestination}
                    settings={settings}
                    onResolved={handleResolved}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <Nav />
      </div>
    </AuthGuard>
  )
}
