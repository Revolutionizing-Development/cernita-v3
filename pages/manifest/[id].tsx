import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AuthGuard from '../../components/AuthGuard'
import { useApp } from '../../lib/context'
import { STORAGE_REQUIREMENT_LABELS, getDecisionLabel } from '../../lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return `$${Math.abs(n).toFixed(0)}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManifestPage() {
  const router = useRouter()
  const { state } = useApp()
  const { boxes, log, locations, settings } = state

  const id = router.query.id ? Number(router.query.id) : null
  const box = id != null ? boxes.find(b => b.id === id) ?? null : null
  const items = id != null ? log.filter(e => e.box_id === id) : []
  const location = box?.current_location_id != null
    ? locations.find(l => l.id === box.current_location_id) ?? null
    : null

  const totalWeight   = items.reduce((s, e) => s + (e.weight_lb   ?? 0), 0)
  const totalVolume   = items.reduce((s, e) => s + (e.volume_cuft ?? 0), 0)
  const totalShipCost = items.reduce((s, e) => s + (e.ship_cost   ?? 0), 0)
  const unknownWeight = items.filter(e => e.weight_lb == null).length

  const [triggered, setTriggered] = useState(false)

  // Auto-print once data is ready
  useEffect(() => {
    if (box && !triggered) {
      const timer = setTimeout(() => {
        window.print()
        setTriggered(true)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [box, triggered])

  const label = box ? getDecisionLabel(box.destination, settings.usDestination) : null
  const storageLabel = box?.storage_requirement
    ? STORAGE_REQUIREMENT_LABELS[box.storage_requirement as keyof typeof STORAGE_REQUIREMENT_LABELS]?.en
    : null

  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const title = box ? `${box.box_number} Manifest — Cernita` : 'Manifest — Cernita'

  return (
    <AuthGuard>
      <Head><title>{title}</title></Head>

      <div className="manifest-page">

        {/* Screen-only toolbar */}
        <div className="manifest-toolbar no-print">
          <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => window.close()}>
            ✕ Close
          </button>
          <span className="serif" style={{ fontSize: 17, letterSpacing: '0.04em' }}>Cernita</span>
          <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => window.print()}>
            ◫ Print · Stampa
          </button>
        </div>

        {!box ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-soft)' }}>
            <p>Loading manifest…</p>
          </div>
        ) : (
          <>
            {/* ── Box header ── */}
            <div className="manifest-header">
              <div className="manifest-box-row">
                <span className="manifest-box-number serif">{box.box_number}</span>
                <span className="manifest-box-dest">{label?.en}</span>
                {label?.it && <em className="manifest-box-dest-it serif">{label.it}</em>}
                {box.box_type === 'suitcase' && box.suitcase_class && (
                  <span className="manifest-box-type">🧳 {box.suitcase_class.replace('_', ' ')}</span>
                )}
                {box.closed_at && <span className="manifest-closed-badge">🔒 Sealed</span>}
              </div>

              <div className="manifest-meta-row">
                {location && (
                  <span className="manifest-meta-item">📍 {location.name}{location.name_it && location.name_it !== location.name ? ` · ${location.name_it}` : ''}</span>
                )}
                {storageLabel && (
                  <span className="manifest-meta-item">🏷 {storageLabel}</span>
                )}
                {box.closed_at && (
                  <span className="manifest-meta-item">Sealed {new Date(box.closed_at).toLocaleDateString()}</span>
                )}
              </div>

              {box.notes && (
                <p className="manifest-notes">{box.notes}</p>
              )}
            </div>

            {/* ── Totals bar ── */}
            <div className="manifest-totals-bar">
              <span><strong>{items.length}</strong> item{items.length !== 1 ? 's' : ''}</span>
              <span>
                <strong>
                  {totalWeight > 0
                    ? `${totalWeight.toFixed(1)} lb`
                    : '— lb'}
                </strong>
                {unknownWeight > 0 && (
                  <em style={{ fontSize: 11 }}> +{unknownWeight} unknown</em>
                )}
              </span>
              {totalVolume > 0 && (
                <span><strong>{totalVolume.toFixed(2)}</strong> cu ft</span>
              )}
              {totalShipCost > 0 && (
                <span>Est. ship <strong>{fmt(totalShipCost)}</strong></span>
              )}
            </div>

            {/* ── Item table ── */}
            {items.length === 0 ? (
              <p className="manifest-empty">
                No items in this box · <em>Nessun oggetto in questa scatola</em>
              </p>
            ) : (
              <table className="manifest-table">
                <thead>
                  <tr>
                    <th className="manifest-th-num">#</th>
                    <th className="manifest-th-item">Item · Oggetto</th>
                    <th className="manifest-th-num">lb</th>
                    <th className="manifest-th-num">cu&nbsp;ft</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e, i) => (
                    <tr key={e.id} className="manifest-row">
                      <td className="manifest-cell-num manifest-cell-idx">{i + 1}</td>
                      <td className="manifest-cell-name">
                        <div className="manifest-item-primary">{e.item_name}</div>
                        {e.item_name_it && (
                          <div className="manifest-item-it">{e.item_name_it}</div>
                        )}
                        {e.item_model && (
                          <div className="manifest-item-model">{e.item_model}</div>
                        )}
                        {e.fragility && e.fragility !== 'none' && (
                          <div className="manifest-item-flag manifest-flag-fragile">
                            ⚠ {e.fragility} fragility
                          </div>
                        )}
                        {e.oversized && (
                          <div className="manifest-item-flag manifest-flag-oversized">
                            ◱ Oversized — ships separately
                          </div>
                        )}
                        {e.shipping_restriction === 'prohibited' && (
                          <div className="manifest-item-flag manifest-flag-hazmat">
                            🚫 International shipping prohibited
                          </div>
                        )}
                        {e.shipping_restriction === 'restricted' && (
                          <div className="manifest-item-flag manifest-flag-hazmat">
                            ⚠️ Shipping restricted
                          </div>
                        )}
                      </td>
                      <td className="manifest-cell-num">
                        {e.weight_lb != null ? e.weight_lb : '—'}
                      </td>
                      <td className="manifest-cell-num">
                        {e.volume_cuft != null ? e.volume_cuft.toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="manifest-totals-row">
                    <td />
                    <td className="manifest-totals-label">Total · Totale</td>
                    <td className="manifest-cell-num manifest-totals-val">
                      {totalWeight > 0 ? totalWeight.toFixed(1) : '—'}
                    </td>
                    <td className="manifest-cell-num manifest-totals-val">
                      {totalVolume > 0 ? totalVolume.toFixed(2) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* ── Footer ── */}
            <div className="manifest-footer">
              <span>Generated {generatedDate}</span>
              <span className="serif">Cernita</span>
              {totalShipCost > 0 && <span>Est. shipping cost: {fmt(totalShipCost)}</span>}
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  )
}
