import Head from 'next/head'
import { useState, useEffect } from 'react'
import AuthGuard from '../../components/AuthGuard'
import { useApp } from '../../lib/context'
import { Decision, DECISION_LABELS, getDecisionLabel } from '../../lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return `$${Math.abs(n).toFixed(0)}`
}

// Decisions in display order, with section labels
const GROUPS: { decision: Decision; label: string }[] = [
  { decision: 'KEEP-ITALY',  label: 'Ship to Italy · Spedire in Italia' },
  { decision: 'KEEP-US',     label: 'Stay in US · Lasciare negli USA' },
  { decision: 'GIVE-FAMILY', label: 'Give to family · Alla famiglia' },
  { decision: 'NEEDS-HUMAN', label: 'Needs discussion · Richiede discussione' },
  { decision: 'SELL',        label: 'Sell · Vendere' },
  { decision: 'DONATE',      label: 'Donate · Donare' },
  { decision: 'DISPOSE',     label: 'Dispose · Smaltire' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryExportPage() {
  const { state } = useApp()
  const { log: entries, settings } = state

  // Filter controls — screen only, hidden in print
  const [include, setInclude] = useState<Set<Decision>>(
    new Set(['KEEP-ITALY', 'KEEP-US', 'GIVE-FAMILY', 'NEEDS-HUMAN', 'SELL', 'DONATE', 'DISPOSE'] as Decision[])
  )

  const [triggered, setTriggered] = useState(false)

  useEffect(() => {
    if (entries.length > 0 && !triggered) {
      const timer = setTimeout(() => {
        window.print()
        setTriggered(true)
      }, 700)
      return () => clearTimeout(timer)
    }
  }, [entries.length, triggered])

  function toggleDecision(d: Decision) {
    setInclude(prev => {
      const next = new Set(prev)
      next.has(d) ? next.delete(d) : next.add(d)
      return next
    })
  }

  const totalItems  = entries.filter(e => include.has(e.final_decision as Decision)).length
  const totalWeight = entries
    .filter(e => include.has(e.final_decision as Decision))
    .reduce((s, e) => s + (e.weight_lb ?? 0), 0)
  const totalValue  = entries
    .filter(e => include.has(e.final_decision as Decision))
    .reduce((s, e) => s + (e.replacement_cost ?? e.estimated_resale_value ?? 0), 0)

  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <AuthGuard>
      <Head><title>Inventory Export — Cernita</title></Head>

      <div className="export-page">

        {/* ── Screen toolbar ── */}
        <div className="export-toolbar no-print">
          <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => window.close()}>
            ✕ Close
          </button>
          <span className="serif" style={{ fontSize: 17, letterSpacing: '0.04em' }}>
            Inventory Export
          </span>
          <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => window.print()}>
            ◫ Print · Stampa
          </button>
        </div>

        {/* ── Filter controls ── */}
        <div className="export-filters no-print">
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Include:
          </span>
          {GROUPS.map(g => {
            const count = entries.filter(e => e.final_decision === g.decision).length
            if (count === 0) return null
            return (
              <button
                key={g.decision}
                className={`filter-pill ${include.has(g.decision) ? 'active' : ''}`}
                style={{ fontSize: 12 }}
                onClick={() => toggleDecision(g.decision)}
              >
                {DECISION_LABELS[g.decision].en.split('—').pop()?.trim()}
                <span className="filter-pill-count">{count}</span>
              </button>
            )
          })}
        </div>

        {/* ── Document header ── */}
        <div className="export-doc-header">
          <div className="export-doc-title">
            <span className="serif" style={{ fontSize: 22, fontWeight: 700 }}>
              Household Inventory
            </span>
            <em className="serif" style={{ fontSize: 15, color: 'var(--ink-soft)' }}>
              Inventario domestico
            </em>
          </div>
          <div className="export-doc-meta">
            <span>Illinois → {settings.usDestination} → Italy</span>
            <span>Generated {generatedDate}</span>
          </div>
          <div className="export-doc-totals">
            <span><strong>{totalItems}</strong> items</span>
            {totalWeight > 0 && <span><strong>{totalWeight.toFixed(1)}</strong> lb total</span>}
            {totalValue > 0 && <span>Est. replacement value <strong>{fmt(totalValue)}</strong></span>}
          </div>
        </div>

        {/* ── Item groups ── */}
        {GROUPS.map(g => {
          const items = entries.filter(
            e => e.final_decision === g.decision && include.has(g.decision)
          )
          if (items.length === 0) return null

          return (
            <div key={g.decision} className="export-group">
              <div className="export-group-header">
                <span className="export-group-label">{g.label}</span>
                <span className="export-group-count">{items.length} item{items.length !== 1 ? 's' : ''}</span>
              </div>

              <table className="export-table">
                <thead>
                  <tr>
                    <th className="export-th-photo">Photo</th>
                    <th className="export-th-item">Item · Oggetto</th>
                    <th className="export-th-num">Value</th>
                    <th className="export-th-num">lb</th>
                    <th className="export-th-num">cu&nbsp;ft</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e, i) => {
                    const value = e.replacement_cost ?? e.estimated_resale_value
                    return (
                      <tr key={e.id} className={`export-row ${i % 2 === 1 ? 'export-row-alt' : ''}`}>
                        <td className="export-cell-photo">
                          {e.photo_data ? (
                            <img
                              src={`data:image/jpeg;base64,${e.photo_data}`}
                              alt=""
                              className="export-photo-thumb"
                            />
                          ) : (
                            <div className="export-photo-empty">◻</div>
                          )}
                        </td>
                        <td className="export-cell-name">
                          <div className="export-item-primary">{e.item_name}</div>
                          {e.item_name_it && (
                            <div className="export-item-it">{e.item_name_it}</div>
                          )}
                          {e.item_model && (
                            <div className="export-item-model">{e.item_model}</div>
                          )}
                          <div className="export-item-flags">
                            {e.oversized && <span className="export-flag">◱ Oversized</span>}
                            {e.shipping_restriction === 'prohibited' && <span className="export-flag export-flag-hazmat">🚫 Cannot ship</span>}
                            {e.shipping_restriction === 'restricted' && <span className="export-flag export-flag-warn">⚠️ Restricted</span>}
                            {e.fragility && e.fragility !== 'none' && <span className="export-flag">⚠ {e.fragility}</span>}
                          </div>
                        </td>
                        <td className="export-cell-num">{fmt(value)}</td>
                        <td className="export-cell-num">{e.weight_lb != null ? e.weight_lb : '—'}</td>
                        <td className="export-cell-num">{e.volume_cuft != null ? e.volume_cuft.toFixed(2) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}

        {totalItems === 0 && (
          <p style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)', fontStyle: 'italic' }}>
            No items selected — use the filters above.
          </p>
        )}

        {/* ── Footer ── */}
        <div className="export-footer">
          <span>Cernita Inventory Export</span>
          <span>{generatedDate}</span>
          <span>{totalItems} items · {totalWeight.toFixed(1)} lb</span>
        </div>
      </div>
    </AuthGuard>
  )
}
