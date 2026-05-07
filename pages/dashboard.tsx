import Head from 'next/head'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import SyncIndicator from '../components/SyncIndicator'
import { useApp } from '../lib/context'
import { useCountUp } from '../lib/useCountUp'
import {
  Decision, Box, Entry, DECISION_BADGE_CLASS, STORAGE_REQUIREMENT_LABELS,
  TRIP_STATUS_LABELS, COLORADO_PLACEMENT_LABELS, ColoradoPlacement,
  getDecisionLabel,
} from '../lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`
}

function fmtLb(n: number): string {
  return `${n.toFixed(0)} lb`
}

const DECISION_ORDER: Decision[] = [
  'SHIP-ITALY', 'SELL', 'DONATE', 'DISPOSE', 'GIVE-FAMILY', 'CONSUME', 'NEEDS-HUMAN',
]

const DECISION_BAR_COLORS: Record<Decision, string> = {
  'SHIP-ITALY':  'var(--olive)',
  'SELL':        'var(--terracotta)',
  'DONATE':      '#5e9e8a',
  'DISPOSE':     'var(--ink-soft)',
  'GIVE-FAMILY': '#8b7355',
  'CONSUME':     '#7a8c9e',
  'NEEDS-HUMAN': '#c9a84c',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { state } = useApp()
  const { log: entries, boxes, trips, locations, settings, syncStatus } = state

  // ── Decision counts ──────────────────────────────────────────────────────
  const counts = DECISION_ORDER.reduce((acc, d) => {
    acc[d] = entries.filter(e => e.final_decision === d).length
    return acc
  }, {} as Record<Decision, number>)

  const total = entries.length

  // ── Italy-bound ──────────────────────────────────────────────────────────
  const italyItems   = entries.filter(e => e.final_decision === 'SHIP-ITALY')
  const italyWeight  = italyItems.filter(e => e.weight_lb != null).reduce((s, e) => s + (e.weight_lb ?? 0), 0)
  const italyVol     = italyItems.filter(e => e.volume_cuft != null).reduce((s, e) => s + (e.volume_cuft ?? 0), 0)
  const italyShipCost = italyItems.reduce((s, e) => s + (e.ship_cost ?? 0), 0)
  const italyUnknownW = italyItems.filter(e => e.weight_lb == null).length

  // ── Colorado move — everything going to Colorado ────────────────────────
  const coloradoMoveItems = entries.filter(e =>
    e.final_decision === 'SHIP-ITALY' ||
    e.action_phase === 'COLORADO' ||
    e.final_decision === 'CONSUME'
  )
  const coloradoMoveWeight = coloradoMoveItems.filter(e => e.weight_lb != null).reduce((s, e) => s + (e.weight_lb ?? 0), 0)
  const coloradoMoveVol = coloradoMoveItems.filter(e => e.volume_cuft != null).reduce((s, e) => s + (e.volume_cuft ?? 0), 0)
  const coloradoUnknownW = coloradoMoveItems.filter(e => e.weight_lb == null).length

  const coMoveCostWeight = coloradoMoveWeight * settings.movingRatePerLb
  const coMoveCostVol = coloradoMoveVol * (settings.coloradoMoveRatePerCuFt ?? 0)
  const coMoveCost = Math.max(coMoveCostWeight, coMoveCostVol) + (settings.coloradoMoveFlatFee ?? 0)

  const coDestinyShipItaly = coloradoMoveItems.filter(e => e.final_decision === 'SHIP-ITALY').length
  const coDestinySellCO = coloradoMoveItems.filter(e => e.final_decision === 'SELL' && e.action_phase === 'COLORADO').length
  const coDestinyDonateCO = coloradoMoveItems.filter(e => e.final_decision === 'DONATE' && e.action_phase === 'COLORADO').length
  const coDestinyConsume = coloradoMoveItems.filter(e => e.final_decision === 'CONSUME').length

  const boxPlacementMap = new Map<number, ColoradoPlacement | null>()
  for (const b of boxes) {
    boxPlacementMap.set((b as Box).id, (b as Box).colorado_placement ?? null)
  }
  const coPlacementCounts: Record<ColoradoPlacement, { count: number; weight: number }> = {
    'ACTIVE-USE':    { count: 0, weight: 0 },
    'HOUSE-STORAGE': { count: 0, weight: 0 },
    'GARAGE':        { count: 0, weight: 0 },
  }
  let coUnplaced = 0
  for (const e of coloradoMoveItems) {
    const placement = e.box_id ? boxPlacementMap.get(e.box_id) : null
    if (placement && coPlacementCounts[placement]) {
      coPlacementCounts[placement].count++
      coPlacementCounts[placement].weight += e.weight_lb ?? 0
    } else {
      coUnplaced++
    }
  }

  // ── Action needed ─────────────────────────────────────────────────────────
  const needsHuman   = entries.filter(e => e.final_decision === 'NEEDS-HUMAN').length
  const hazmatProhib = entries.filter(e => e.shipping_restriction === 'prohibited').length
  const hazmatRestr  = entries.filter(e => e.shipping_restriction === 'restricted').length
  const unboxed      = entries.filter(e => e.box_id == null).length

  // ── Boxes ──────────────────────────────────────────────────────────────────
  const totalBoxes    = boxes.length
  const suitcaseCount = boxes.filter(b => b.box_type === 'suitcase').length
  const plasticCount = boxes.filter(b => b.box_type !== 'suitcase').length
  const climateBoxes  = boxes.filter(b => b.storage_requirement === 'climate_controlled').length
  const garageBoxes   = boxes.filter(b => b.storage_requirement === 'garage_ok').length
  const closedBoxes   = boxes.filter(b => b.closed_at).length

  // ── Trips ──────────────────────────────────────────────────────────────────
  const upcomingTrips = trips
    .filter(t => t.status === 'planned' || t.status === 'packing')
    .sort((a, b) => (a.departure_date ?? '').localeCompare(b.departure_date ?? ''))
    .slice(0, 3)

  // ── Count-up targets ───────────────────────────────────────────────────────
  const animTotal        = useCountUp(total)
  const animItaly        = useCountUp(italyItems.length)
  const animItalyWeight  = useCountUp(Math.round(italyWeight))
  const animItalyCost    = useCountUp(Math.round(italyShipCost))
  const animUnboxed      = useCountUp(unboxed)
  const animNeedsHuman   = useCountUp(needsHuman)

  const locationName = (id: number | null) =>
    id ? (locations.find(l => l.id === id)?.name ?? '—') : '—'

  return (
    <AuthGuard>
      <Head><title>Cernita — Overview</title></Head>
      <div className="app-shell">

        <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--paper-dark)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="serif" style={{ fontSize: '20px' }}>
            Overview · <em className="ink-soft" style={{ fontStyle: 'italic', fontSize: '16px' }}>Panoramica</em>
          </span>
          <SyncIndicator />
        </header>

        <div className="page-content">

          {total === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 36, marginBottom: 12 }}>{syncStatus === 'syncing' ? '◌' : '◈'}</div>
              <h3>{syncStatus === 'syncing' ? 'Loading… · Caricamento…' : 'Nothing evaluated yet'}</h3>
              <p className="italic ink-soft">
                {syncStatus === 'syncing'
                  ? 'Connecting to database… · Connessione al database…'
                  : 'Evaluate your first item to see the overview.'}
              </p>
            </div>
          ) : (
            <>

              {/* ── At a glance ── */}
              <div className="dash-section">
                <div className="dash-hero">
                  <span className="dash-hero-number serif">{animTotal}</span>
                  <span className="dash-hero-label">items evaluated · <em className="italic">oggetti valutati</em></span>
                </div>

                {/* Decision breakdown bar */}
                <div className="dash-bar" aria-label="Decision breakdown">
                  {DECISION_ORDER.filter(d => counts[d] > 0).map(d => (
                    <div
                      key={d}
                      className="dash-bar-segment"
                      style={{
                        flex: counts[d],
                        background: DECISION_BAR_COLORS[d],
                      }}
                      title={`${getDecisionLabel(d, settings.usDestination).en}: ${counts[d]}`}
                    />
                  ))}
                </div>

                {/* Decision legend */}
                <div className="dash-legend">
                  {DECISION_ORDER.filter(d => counts[d] > 0).map(d => {
                    const lbl = getDecisionLabel(d, settings.usDestination)
                    const short = lbl.en.split('—').pop()?.trim() ?? lbl.en
                    return (
                      <div key={d} className="dash-legend-item">
                        <span className="dash-legend-dot" style={{ background: DECISION_BAR_COLORS[d] }} />
                        <span className="dash-legend-count">{counts[d]}</span>
                        <span className="dash-legend-label">{short}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Action needed ── */}
              {(needsHuman > 0 || hazmatProhib > 0 || hazmatRestr > 0 || unboxed > 0) && (
                <div className="dash-section">
                  <h2 className="dash-section-title">Action needed · <em>Da fare</em></h2>
                  <div className="dash-action-grid">
                    {needsHuman > 0 && (
                      <div className="dash-action-card dash-action-discuss">
                        <span className="dash-action-number serif">{animNeedsHuman}</span>
                        <span className="dash-action-label">need discussion</span>
                        <em className="dash-action-label-it">da discutere</em>
                      </div>
                    )}
                    {hazmatProhib > 0 && (
                      <div className="dash-action-card dash-action-hazmat">
                        <span className="dash-action-icon">🚫</span>
                        <span className="dash-action-number serif">{hazmatProhib}</span>
                        <span className="dash-action-label">prohibited to ship</span>
                        <em className="dash-action-label-it">non spedibili</em>
                      </div>
                    )}
                    {hazmatRestr > 0 && (
                      <div className="dash-action-card dash-action-warn">
                        <span className="dash-action-icon">⚠️</span>
                        <span className="dash-action-number serif">{hazmatRestr}</span>
                        <span className="dash-action-label">shipping restricted</span>
                        <em className="dash-action-label-it">con restrizioni</em>
                      </div>
                    )}
                    {unboxed > 0 && (
                      <div className="dash-action-card dash-action-unboxed">
                        <span className="dash-action-number serif">{animUnboxed}</span>
                        <span className="dash-action-label">unboxed</span>
                        <em className="dash-action-label-it">non inscatolati</em>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Italy-bound ── */}
              {italyItems.length > 0 && (
                <div className="dash-section">
                  <h2 className="dash-section-title">
                    Going to Italy · <em>Diretti in Italia</em>
                    <span className={`${DECISION_BADGE_CLASS['SHIP-ITALY']} dash-section-badge`}>{animItaly}</span>
                  </h2>
                  <div className="dash-stat-row">
                    <div className="dash-stat">
                      <span className="dash-stat-value serif">{animItalyWeight}<span className="dash-stat-unit"> lb</span></span>
                      <span className="dash-stat-label">total weight{italyUnknownW > 0 ? ` (${italyUnknownW} unknown)` : ''}</span>
                    </div>
                    {italyVol > 0 && (
                      <div className="dash-stat">
                        <span className="dash-stat-value serif">{italyVol.toFixed(1)}<span className="dash-stat-unit"> cu ft</span></span>
                        <span className="dash-stat-label">total volume</span>
                      </div>
                    )}
                    {italyShipCost > 0 && (
                      <div className="dash-stat">
                        <span className="dash-stat-value serif">{fmt(animItalyCost)}</span>
                        <span className="dash-stat-label">est. ship cost</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Colorado move ── */}
              {coloradoMoveItems.length > 0 && (
                <div className="dash-section">
                  <h2 className="dash-section-title">
                    Colorado move · <em>Trasloco in Colorado</em>
                  </h2>
                  <div className="dash-stat-row">
                    <div className="dash-stat">
                      <span className="dash-stat-value serif">{coloradoMoveItems.length}</span>
                      <span className="dash-stat-label">items{coloradoUnknownW > 0 ? ` (${coloradoUnknownW} unknown wt)` : ''}</span>
                    </div>
                    <div className="dash-stat">
                      <span className="dash-stat-value serif">{fmtLb(coloradoMoveWeight)}</span>
                      <span className="dash-stat-label">est. weight</span>
                    </div>
                    {coloradoMoveVol > 0 && (
                      <div className="dash-stat">
                        <span className="dash-stat-value serif">{coloradoMoveVol.toFixed(1)}<span className="dash-stat-unit"> cu ft</span></span>
                        <span className="dash-stat-label">est. volume</span>
                      </div>
                    )}
                  </div>
                  {(coPlacementCounts['ACTIVE-USE'].count > 0 || coPlacementCounts['HOUSE-STORAGE'].count > 0 || coPlacementCounts['GARAGE'].count > 0) && (
                    <div className="dash-co-placement">
                      <p className="dash-co-sublabel">By placement · <em className="italic ink-soft">Per collocazione</em></p>
                      <div className="dash-co-placement-grid">
                        {(Object.keys(COLORADO_PLACEMENT_LABELS) as ColoradoPlacement[])
                          .filter(p => coPlacementCounts[p].count > 0)
                          .map(p => (
                            <div key={p} className="dash-co-placement-item">
                              <span className="dash-co-placement-icon">{COLORADO_PLACEMENT_LABELS[p].icon}</span>
                              <span className="dash-co-placement-label">{COLORADO_PLACEMENT_LABELS[p].en}</span>
                              <span className="dash-co-placement-count">{coPlacementCounts[p].count} · {fmtLb(coPlacementCounts[p].weight)}</span>
                            </div>
                          ))}
                        {coUnplaced > 0 && (
                          <div className="dash-co-placement-item dash-co-placement-unplaced">
                            <span className="dash-co-placement-icon">◻</span>
                            <span className="dash-co-placement-label">Unplaced</span>
                            <span className="dash-co-placement-count">{coUnplaced}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="dash-co-destiny">
                    <p className="dash-co-sublabel">By ultimate destiny · <em className="italic ink-soft">Per destinazione finale</em></p>
                    <div className="dash-co-destiny-grid">
                      {coDestinyShipItaly > 0 && <span className="dash-co-destiny-item">🇮🇹 Ship to Italy: {coDestinyShipItaly}</span>}
                      {coDestinySellCO > 0 && <span className="dash-co-destiny-item">💰 Sell in CO: {coDestinySellCO}</span>}
                      {coDestinyDonateCO > 0 && <span className="dash-co-destiny-item">🎁 Donate in CO: {coDestinyDonateCO}</span>}
                      {coDestinyConsume > 0 && <span className="dash-co-destiny-item">🧴 Consume: {coDestinyConsume}</span>}
                    </div>
                  </div>
                  {coMoveCost > 0 && (
                    <div className="dash-co-cost">
                      <div className="dash-cost-block">
                        <span className="dash-cost-label">Ground move estimate</span>
                        <span className="dash-cost-value serif">{fmt(coMoveCost)}</span>
                        <span className="dash-cost-sub">
                          ${settings.movingRatePerLb}/lb
                          {(settings.coloradoMoveRatePerCuFt ?? 0) > 0 ? ` · $${settings.coloradoMoveRatePerCuFt}/cu ft` : ''}
                          {(settings.coloradoMoveFlatFee ?? 0) > 0 ? ` + $${settings.coloradoMoveFlatFee} flat` : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Boxes ── */}
              {totalBoxes > 0 && (
                <div className="dash-section">
                  <h2 className="dash-section-title">Boxes · <em>Scatole</em></h2>
                  <div className="dash-boxes-row">
                    <div className="dash-box-stat">
                      <span className="dash-box-num serif">{totalBoxes}</span>
                      <span className="dash-box-lbl">total</span>
                    </div>
                    {plasticCount > 0 && (
                      <div className="dash-box-stat">
                        <span className="dash-box-num serif">{plasticCount}</span>
                        <span className="dash-box-lbl">📦 plastic</span>
                      </div>
                    )}
                    {suitcaseCount > 0 && (
                      <div className="dash-box-stat">
                        <span className="dash-box-num serif">{suitcaseCount}</span>
                        <span className="dash-box-lbl">🧳 suitcases</span>
                      </div>
                    )}
                    {closedBoxes > 0 && (
                      <div className="dash-box-stat">
                        <span className="dash-box-num serif">{closedBoxes}</span>
                        <span className="dash-box-lbl">closed</span>
                      </div>
                    )}
                  </div>
                  {(climateBoxes > 0 || garageBoxes > 0) && (
                    <div className="dash-storage-row">
                      {climateBoxes > 0 && (
                        <span className="dash-storage-pill dash-storage-climate">
                          ❄ {climateBoxes} climate controlled
                        </span>
                      )}
                      {garageBoxes > 0 && (
                        <span className="dash-storage-pill dash-storage-garage">
                          🏠 {garageBoxes} garage ok
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Upcoming trips ── */}
              {upcomingTrips.length > 0 && (
                <div className="dash-section">
                  <h2 className="dash-section-title">Upcoming trips · <em>Viaggi in programma</em></h2>
                  {upcomingTrips.map(trip => {
                    const tripBags = boxes.filter(b => b.trip_id === trip.id && b.box_type === 'suitcase')
                    const tripWeight = tripBags.reduce((sum, b) => {
                      const w = entries.filter(e => e.box_id === b.id).reduce((s, e) => s + (e.weight_lb ?? 0), 0)
                      return sum + w
                    }, 0)
                    const statusLbl = TRIP_STATUS_LABELS[trip.status]
                    return (
                      <div key={trip.id} className="dash-trip-row">
                        <div className="dash-trip-main">
                          <span className="dash-trip-name">{trip.name}</span>
                          <span className={`trip-status-pill trip-status-${trip.status}`}>{statusLbl.en}</span>
                        </div>
                        <div className="dash-trip-meta">
                          {locationName(trip.origin_location_id)} → {locationName(trip.destination_location_id)}
                          {trip.departure_date && (
                            <span className="ink-soft"> · {new Date(trip.departure_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          )}
                          {tripBags.length > 0 && (
                            <span> · {tripBags.length} bag{tripBags.length !== 1 ? 's' : ''}{tripWeight > 0 ? `, ~${tripWeight.toFixed(0)} lb` : ''}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── Total cost summary ── */}
              {(italyShipCost > 0 || coMoveCost > 0) && (
                <div className="dash-section dash-section-costs">
                  <h2 className="dash-section-title">Estimated costs · <em>Costi stimati</em></h2>
                  <p className="settings-hint" style={{ marginBottom: 12 }}>
                    Based on current rates (v{settings.rulesVersion}). Rates updated in Settings.
                  </p>
                  <div className="dash-cost-row">
                    {coMoveCost > 0 && (
                      <div className="dash-cost-block">
                        <span className="dash-cost-label">Ground move (IL→CO)</span>
                        <span className="dash-cost-value serif">{fmt(coMoveCost)}</span>
                        <span className="dash-cost-sub">{coloradoMoveItems.length} items · {fmtLb(coloradoMoveWeight)}</span>
                      </div>
                    )}
                    {italyShipCost > 0 && (
                      <div className="dash-cost-block">
                        <span className="dash-cost-label">Ocean shipping (CO→IT)</span>
                        <span className="dash-cost-value serif">{fmt(italyShipCost)}</span>
                        <span className="dash-cost-sub">{italyItems.length} items · {fmtLb(italyWeight)}</span>
                      </div>
                    )}
                    {(italyShipCost > 0 || coMoveCost > 0) && (
                      <div className="dash-cost-block dash-cost-total">
                        <span className="dash-cost-label">Total estimated</span>
                        <span className="dash-cost-value serif">{fmt(italyShipCost + coMoveCost)}</span>
                        <span className="dash-cost-sub">ground + ocean</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </>
          )}
        </div>
        <Nav />
      </div>
    </AuthGuard>
  )
}
