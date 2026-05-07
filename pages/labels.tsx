import Head from 'next/head'
import { useRouter } from 'next/router'
import AuthGuard from '../components/AuthGuard'
import { useApp } from '../lib/context'
import { Box, Entry, Decision, DECISION_LABELS } from '../lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert pounds to kg, one decimal place */
function lbToKg(lb: number): string {
  return (lb * 0.453592).toFixed(1)
}

/** Fragility rank for comparison */
const FRAGILITY_RANK: Record<string, number> = {
  none: 0, low: 1, medium: 2, high: 3, irreplaceable: 4,
}

function maxFragility(items: Entry[]): string {
  return items.reduce((max, e) => {
    const f = e.fragility ?? 'none'
    return FRAGILITY_RANK[f] > FRAGILITY_RANK[max] ? f : max
  }, 'none')
}

// ─── Single label component ────────────────────────────────────────────────────

interface BoxLabelProps {
  box: Box
  items: Entry[]
  declarant: string
  italyAddress: string
  boxIndex: number    // 1-based position in the printed set
  totalBoxes: number  // total in the printed set
}

function BoxLabel({ box, items, declarant, italyAddress, boxIndex, totalBoxes }: BoxLabelProps) {
  const totalWeightLb = items.reduce((s, e) => s + (e.weight_lb ?? 0), 0)
  const unknownWeightCount = items.filter(e => e.weight_lb == null).length
  const hasWeight = totalWeightLb > 0 || unknownWeightCount === 0

  const frag = maxFragility(items)
  const isHighFragile  = frag === 'high' || frag === 'irreplaceable'
  const isMedFragile   = frag === 'medium'
  const isClimate      = box.storage_requirement === 'climate_controlled'
  const hasHazmat      = items.some(e => e.shipping_restriction === 'restricted')

  const label = DECISION_LABELS[box.destination as Decision]

  // Address lines — split on newline for rendering
  const addressLines = italyAddress
    ? italyAddress.split('\n').map(l => l.trim()).filter(Boolean)
    : []

  const today = new Date().toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <div className="lbl-card">

      {/* ── Top band: box number + destination + handling marks ── */}
      <div className="lbl-top">
        <div className="lbl-id-block">
          <span className="lbl-box-num serif">{box.box_number}</span>
          <span className="lbl-box-of">
            {boxIndex} di {totalBoxes} · {boxIndex} of {totalBoxes}
          </span>
          {label && (
            <span className="lbl-destination">
              {label.it} · {label.en}
            </span>
          )}
        </div>

        <div className="lbl-marks-block">
          <div className="lbl-mark lbl-mark-up">
            <span className="lbl-mark-icon">↑</span>
            <span className="lbl-mark-text">ALTO<br />THIS SIDE UP</span>
          </div>
          {(isHighFragile || isMedFragile) && (
            <div className="lbl-mark lbl-mark-fragile">
              <span className="lbl-mark-icon">◇</span>
              <span className="lbl-mark-text">FRAGILE<br />MANEGGIARE CON CURA</span>
            </div>
          )}
          {isClimate && (
            <div className="lbl-mark lbl-mark-dry">
              <span className="lbl-mark-icon">☔</span>
              <span className="lbl-mark-text">TENERE ALL'ASCIUTTO<br />KEEP DRY</span>
            </div>
          )}
          {isClimate && (
            <div className="lbl-mark lbl-mark-heat">
              <span className="lbl-mark-icon">☀</span>
              <span className="lbl-mark-text">NON ESPORRE AL CALORE<br />KEEP FROM HEAT</span>
            </div>
          )}
          {hasHazmat && (
            <div className="lbl-mark lbl-mark-warn">
              <span className="lbl-mark-icon">⚠</span>
              <span className="lbl-mark-text">OGGETTI LIMITATI<br />RESTRICTED ITEMS</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Parties: shipper + consignee ── */}
      <div className="lbl-parties">
        <div className="lbl-party">
          <span className="lbl-party-label">MITTENTE / SHIPPER</span>
          <span className="lbl-party-name">{declarant}</span>
          <span className="lbl-party-addr">Illinois, USA</span>
        </div>
        <div className="lbl-party">
          <span className="lbl-party-label">DESTINATARIO / CONSIGNEE</span>
          <span className="lbl-party-name">{declarant}</span>
          {addressLines.length > 0
            ? addressLines.map((line, i) => (
                <span key={i} className="lbl-party-addr">{line}</span>
              ))
            : <span className="lbl-party-addr lbl-addr-missing">
                — indirizzo non impostato · add in Settings —
              </span>
          }
          <span className="lbl-party-addr" style={{ fontWeight: 700 }}>ITALIA</span>
        </div>
      </div>

      {/* ── Contents list ── */}
      <div className="lbl-contents">
        <span className="lbl-section-label">
          CONTENUTO / CONTENTS
          {items.length > 0 && (
            <span className="lbl-item-count">
              &nbsp;· {items.length} oggett{items.length === 1 ? 'o' : 'i'} · {items.length} item{items.length !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        {items.length === 0 ? (
          <span className="lbl-contents-empty">Nessun oggetto assegnato · No items assigned</span>
        ) : (
          <ol className="lbl-contents-list">
            {items.map((e, i) => (
              <li key={e.id} className="lbl-contents-row">
                <span className="lbl-contents-num">{i + 1}.</span>
                <span className="lbl-contents-name">
                  {e.item_name_it ?? e.item_name}
                  {e.item_name_it && (
                    <span className="lbl-contents-name-en"> / {e.item_name}</span>
                  )}
                  {e.item_model && (
                    <span className="lbl-contents-model"> — {e.item_model}</span>
                  )}
                </span>
                <span className="lbl-contents-cond">USATO</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ── Weight + pieces row ── */}
      <div className="lbl-metrics">
        <div className="lbl-metric">
          <span className="lbl-metric-label">PESO LORDO · GROSS WEIGHT</span>
          <span className="lbl-metric-value serif">
            {hasWeight
              ? `${lbToKg(totalWeightLb)} kg (${totalWeightLb.toFixed(1)} lb)`
              : '— kg (peso non rilevato)'}
          </span>
          {unknownWeightCount > 0 && (
            <span className="lbl-metric-note">
              {unknownWeightCount} item{unknownWeightCount !== 1 ? 's' : ''} senza peso · weight unknown
            </span>
          )}
        </div>
        <div className="lbl-metric">
          <span className="lbl-metric-label">COLLI · PIECES</span>
          <span className="lbl-metric-value serif">{items.length}</span>
        </div>
      </div>

      {/* ── Customs footer ── */}
      <div className="lbl-customs">
        <div className="lbl-customs-row">
          <span className="lbl-customs-field">
            <em>Natura della merce:</em> Effetti personali usati / Used personal household effects
          </span>
        </div>
        <div className="lbl-customs-row">
          <span className="lbl-customs-field">
            <em>Regime doganale:</em> Trasferimento di residenza / Change of residence
          </span>
        </div>
        <div className="lbl-customs-row">
          <span className="lbl-customs-field">
            <em>Rif. normativo:</em> D.P.R. n. 43/1973 e s.m.i. — Reg. UE n. 952/2013 (UCC)
          </span>
        </div>
        <div className="lbl-customs-row">
          <span className="lbl-customs-field">
            <em>Condizione:</em> USATO / USED &nbsp;·&nbsp; <em>Origine:</em> USA
            &nbsp;·&nbsp; <em>Data:</em> {today}
          </span>
        </div>
      </div>

    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LabelsPage() {
  const router = useRouter()
  const { state } = useApp()
  const { boxes, log, settings, user } = state

  const preselectedId = router.query.id ? Number(router.query.id) : null

  const declarant =
    user?.user_metadata?.display_name ??
    user?.email?.split('@')[0] ??
    '—'

  // Which boxes to show — only SHIP-ITALY by default; single-box if ?id= given
  const printBoxes = preselectedId
    ? boxes.filter(b => b.id === preselectedId)
    : boxes
        .filter(b => b.destination === 'SHIP-ITALY')
        .sort((a, b) => a.box_number.localeCompare(b.box_number))

  const italyCount = boxes.filter(b => b.destination === 'SHIP-ITALY').length

  const missingAddress = !settings.italyAddress.trim()

  return (
    <AuthGuard>
      <Head><title>Etichette Scatole / Box Labels — Cernita</title></Head>

      <div className="lbl-page">

        {/* ── Toolbar (screen only) ── */}
        <div className="lbl-toolbar no-print">
          <button
            className="btn-secondary"
            style={{ fontSize: 13 }}
            onClick={() => window.close()}
          >
            ✕ Close
          </button>
          <span className="serif" style={{ fontSize: 16 }}>
            Etichette doganali · Box labels
          </span>
          <button
            className="btn-primary"
            style={{ fontSize: 13 }}
            onClick={() => window.print()}
          >
            ◫ Stampa · Print
          </button>
        </div>

        {/* ── Address warning (screen only) ── */}
        {missingAddress && (
          <div className="lbl-warning no-print">
            <strong>⚠ Indirizzo italiano mancante · Italian address missing</strong>
            <br />
            Add your Italian destination address in{' '}
            <strong>Settings → Documents → Italian destination address</strong>{' '}
            before printing. Italian customs requires the full consignee address on each label
            (via, CAP, comune, provincia).
          </div>
        )}

        {/* ── Labels ── */}
        {printBoxes.length === 0 ? (
          <div className="lbl-empty no-print">
            <p>
              {preselectedId
                ? 'Box not found.'
                : `No SHIP-ITALY boxes yet (${italyCount} total Italy-bound). Evaluate items and assign them to boxes.`}
            </p>
          </div>
        ) : (
          printBoxes.map((box, i) => (
            <BoxLabel
              key={box.id}
              box={box}
              items={log.filter(e => e.box_id === box.id)}
              declarant={declarant}
              italyAddress={settings.italyAddress}
              boxIndex={i + 1}
              totalBoxes={printBoxes.length}
            />
          ))
        )}

      </div>
    </AuthGuard>
  )
}
