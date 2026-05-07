import Head from 'next/head'
import { useState, useMemo } from 'react'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import SyncIndicator from '../components/SyncIndicator'
import { useApp } from '../lib/context'
import { supabase } from '../lib/supabase'
import haptic from '../lib/haptic'
import {
  Entry, Box, Decision, CustomsCategory, CUSTOMS_CATEGORY_LABELS, DEFAULT_CUSTOMS_PROFILE,
  DECISION_LABELS, DECISION_BADGE_CLASS, getDecisionLabel,
} from '../lib/types'
import {
  autoAssignCategory, checkCompleteness, groupByCategory,
  generateCoverDeclaration, generateGoodsTable, GoodsRow,
} from '../lib/customs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  return `€${n.toFixed(2)}`
}

// ─── Completeness banner ──────────────────────────────────────────────────────

function CompletenessBanner({
  total,
  missingYear,
  missingValue,
  missingItalianName,
  excluded,
  onShowIncomplete,
}: {
  total: number
  missingYear: number
  missingValue: number
  missingItalianName: number
  excluded: number
  onShowIncomplete: () => void
}) {
  const issues = missingYear + missingValue + missingItalianName
  if (issues === 0) {
    return (
      <div className="customs-banner customs-banner-ok">
        <span style={{ fontSize: 20 }}>✓</span>
        <p>{total} items ready for declaration{excluded > 0 ? ` · ${excluded} excluded` : ''}</p>
      </div>
    )
  }
  return (
    <div className="customs-banner customs-banner-warn">
      <span style={{ fontSize: 20 }}>⚠</span>
      <div>
        <p><strong>{issues} items need attention</strong></p>
        <ul style={{ fontSize: 13, margin: '4px 0 0 16px', lineHeight: 1.6 }}>
          {missingYear > 0 && <li>{missingYear} missing acquisition year</li>}
          {missingValue > 0 && <li>{missingValue} missing estimated value</li>}
          {missingItalianName > 0 && <li>{missingItalianName} missing Italian name</li>}
        </ul>
        <button className="btn-link" style={{ marginTop: 6 }} onClick={onShowIncomplete}>
          Review incomplete items · Rivedi elementi incompleti
        </button>
      </div>
    </div>
  )
}

// ─── Incomplete items editor ──────────────────────────────────────────────────

function IncompleteEditor({
  items,
  onUpdate,
  onBack,
}: {
  items: Entry[]
  onUpdate: (entry: Entry) => void
  onBack: () => void
}) {
  const [saving, setSaving] = useState<number | null>(null)

  async function handleSetYear(entry: Entry, year: number | null) {
    setSaving(entry.id)
    const { data, error } = await supabase
      .from('cernita_entries')
      .update({ acquisition_year: year })
      .eq('id', entry.id)
      .select()
      .single()
    setSaving(null)
    if (!error && data) onUpdate(data as Entry)
  }

  async function handleBulkPredate() {
    const currentYear = new Date().getFullYear()
    const preDateYear = currentYear - 2
    const toFix = items.filter(e => !e.acquisition_year)
    for (const entry of toFix) {
      const { data, error } = await supabase
        .from('cernita_entries')
        .update({ acquisition_year: preDateYear })
        .eq('id', entry.id)
        .select()
        .single()
      if (!error && data) onUpdate(data as Entry)
    }
    haptic.confirm()
  }

  const missingYear = items.filter(e => !e.acquisition_year)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button className="btn-link" onClick={onBack}>&larr; Back to review</button>
        {missingYear.length > 0 && (
          <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={handleBulkPredate}>
            Mark all as pre-{new Date().getFullYear() - 1}
          </button>
        )}
      </div>

      {items.map(entry => (
        <div key={entry.id} className="customs-incomplete-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: 14 }}>{entry.item_name}</p>
            {entry.item_name_it && <p className="italic ink-soft" style={{ fontSize: 12 }}>{entry.item_name_it}</p>}
            {!entry.item_name_it && <p style={{ fontSize: 12, color: '#8b1a1a' }}>Missing Italian name</p>}
            {entry.estimated_resale_value == null && entry.replacement_cost == null && (
              <p style={{ fontSize: 12, color: '#8b1a1a' }}>Missing value estimate</p>
            )}
          </div>
          <div style={{ width: 90, flexShrink: 0 }}>
            <input
              type="number"
              className="input"
              style={{ fontSize: 13, padding: '6px 8px', textAlign: 'center' }}
              placeholder="Year"
              value={entry.acquisition_year ?? ''}
              onChange={e => {
                const v = e.target.value ? parseInt(e.target.value) : null
                if (v && (v < 1900 || v > new Date().getFullYear())) return
                handleSetYear(entry, v)
              }}
              disabled={saving === entry.id}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Category accordion ───────────────────────────────────────────────────────

function CategoryGroup({
  category,
  items,
  eurRate,
  expanded,
  onToggle,
}: {
  category: CustomsCategory
  items: Entry[]
  eurRate: number
  expanded: boolean
  onToggle: () => void
}) {
  const label = CUSTOMS_CATEGORY_LABELS[category]
  const totalEur = items.reduce((sum, e) => {
    const usd = e.replacement_cost ?? e.estimated_resale_value ?? 0
    return sum + usd * eurRate
  }, 0)

  return (
    <div className="customs-category">
      <button className="customs-category-header" onClick={onToggle}>
        <span>
          <strong>{label.it}</strong>
          <span className="ink-soft" style={{ fontSize: 12, marginLeft: 8 }}>{label.en}</span>
        </span>
        <span className="customs-category-meta">
          {items.length} · {fmtEur(totalEur)}
          <span style={{ marginLeft: 6 }}>{expanded ? '▾' : '▸'}</span>
        </span>
      </button>
      {expanded && (
        <div className="customs-category-items">
          {items.map(item => {
            const usd = item.replacement_cost ?? item.estimated_resale_value ?? 0
            const eur = usd * eurRate
            return (
              <div key={item.id} className="customs-item-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13 }}>{item.item_name_it || item.item_name}</span>
                  {item.item_name_it && (
                    <span className="ink-soft" style={{ fontSize: 11, marginLeft: 6 }}>{item.item_name}</span>
                  )}
                </div>
                <span className="ink-soft" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {item.acquisition_year ?? '—'} · {fmtEur(eur)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Declaration preview (printable) ──────────────────────────────────────────

function DeclarationPreview({
  coverText,
  rows,
  totalEur,
  onClose,
}: {
  coverText: string
  rows: GoodsRow[]
  totalEur: number
  onClose: () => void
}) {
  return (
    <div className="customs-preview">
      <div className="customs-preview-actions no-print">
        <button className="btn-secondary" onClick={onClose}>Close · Chiudi</button>
        <button className="btn-primary" onClick={() => window.print()}>Print / PDF · Stampa</button>
      </div>

      <div className="customs-doc">
        {/* Cover declaration */}
        <pre className="customs-cover-text">{coverText}</pre>

        <div style={{ pageBreakBefore: 'always' }} />

        {/* Goods list header */}
        <h2 className="customs-goods-title">
          Allegato alla dichiarazione di trasferimento di residenza
          <br />
          <span style={{ fontSize: 14, fontWeight: 400 }}>
            Elenco analitico dei beni mobili di uso domestico e personale
          </span>
          <br />
          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
            Ai sensi del Regolamento (CE) n. 1186/2009, Articolo 3
          </span>
        </h2>

        {/* Goods table */}
        <table className="customs-goods-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>N.</th>
              <th>Descrizione del bene</th>
              <th style={{ width: 140 }}>Riferimento inglese</th>
              <th style={{ width: 36 }}>Qt.</th>
              <th style={{ width: 80 }}>Valore (EUR)</th>
              <th style={{ width: 50 }}>Anno</th>
              <th style={{ width: 120 }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.type === 'header') {
                return (
                  <tr key={`h-${i}`} className="customs-goods-cat-row">
                    <td colSpan={7}><strong>{row.categoryLabel}</strong></td>
                  </tr>
                )
              }
              return (
                <tr key={`r-${i}`}>
                  <td style={{ textAlign: 'center' }}>{row.n}</td>
                  <td>{row.descriptionIt}</td>
                  <td className="ink-soft" style={{ fontSize: 11 }}>{row.descriptionEn}</td>
                  <td style={{ textAlign: 'center' }}>{row.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{row.valueEur != null ? fmtEur(row.valueEur) : '—'}</td>
                  <td style={{ textAlign: 'center' }}>{row.acquisitionYear ?? '—'}</td>
                  <td style={{ fontSize: 11 }}>{row.notes ?? ''}</td>
                </tr>
              )
            })}
            <tr className="customs-goods-total-row">
              <td colSpan={4} style={{ textAlign: 'right' }}><strong>TOTALE</strong></td>
              <td style={{ textAlign: 'right' }}><strong>{fmtEur(totalEur)}</strong></td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>

        {/* Disclaimer */}
        <div className="customs-disclaimer">
          <p>
            Questo documento è stato preparato utilizzando Cernita. Si tratta di una bozza da sottoporre
            alla revisione del dichiarante e del proprio spedizioniere doganale prima della presentazione.
            Il dichiarante è responsabile della sua accuratezza.
          </p>
          <p className="ink-soft" style={{ marginTop: 6 }}>
            This document was prepared using Cernita. It is a draft for review by the declarant and their
            authorized customs broker before filing. The declarant is responsible for its accuracy.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Italy Confirmation Flow (spec 016 Part 3) ─────────────────────────────────

type ItemCondition = 'good' | 'worn' | 'broken'

const CONDITION_LABELS: Record<ItemCondition, { en: string; it: string }> = {
  good:   { en: 'Good condition',  it: 'Buone condizioni' },
  worn:   { en: 'Worn / used',    it: 'Usato / consumato' },
  broken: { en: 'Broken',         it: 'Rotto' },
}

const CHANGE_DECISIONS: Decision[] = ['SELL', 'DONATE', 'DISPOSE']

function ItalyConfirmationFlow({
  items,
  settings,
  onUpdate,
  onBack,
}: {
  items: Entry[]
  settings: import('../lib/types').CernitaSettings
  onUpdate: (entry: Entry) => void
  onBack: () => void
}) {
  const [saving, setSaving] = useState<number | null>(null)
  const [conditions, setConditions] = useState<Record<number, ItemCondition>>({})
  const [changingDecision, setChangingDecision] = useState<number | null>(null)
  const [error, setError] = useState('')

  const voltageItems = items.filter(e => e.voltage_incompatible)
  const compatibleItems = items.filter(e => !e.voltage_incompatible)

  async function handleConfirm(entry: Entry) {
    setSaving(entry.id)
    setError('')
    const { data, error: err } = await supabase
      .from('cernita_entries')
      .update({ italy_confirmed: true })
      .eq('id', entry.id)
      .select()
      .single()
    setSaving(null)
    if (err || !data) { setError('Save failed — try again.'); return }
    haptic.confirm()
    onUpdate(data as Entry)
  }

  async function handleChangeDecision(entry: Entry, newDecision: Decision) {
    setSaving(entry.id)
    setError('')
    const { data, error: err } = await supabase
      .from('cernita_entries')
      .update({
        final_decision: newDecision,
        action_phase: 'COLORADO',
        override_reason: `Re-evaluation: changed from SHIP-ITALY during Italy confirmation review`,
        user_confirmed: true,
      })
      .eq('id', entry.id)
      .select()
      .single()
    setSaving(null)
    setChangingDecision(null)
    if (err || !data) { setError('Save failed — try again.'); return }
    haptic.confirm()
    onUpdate(data as Entry)
  }

  async function handleConfirmAllCompatible() {
    const toConfirm = compatibleItems.filter(e => {
      const cond = conditions[e.id]
      return !cond || cond === 'good'
    })
    if (toConfirm.length === 0) return
    setSaving(-1)
    for (const entry of toConfirm) {
      const { data, error: err } = await supabase
        .from('cernita_entries')
        .update({ italy_confirmed: true })
        .eq('id', entry.id)
        .select()
        .single()
      if (!err && data) onUpdate(data as Entry)
    }
    setSaving(null)
    haptic.confirm()
  }

  function fmtCost(n: number | null | undefined): string {
    if (n == null) return '—'
    return `$${Math.abs(n).toFixed(0)}`
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button className="btn-link" onClick={onBack}>&larr; Back to review · Torna alla revisione</button>
      </div>

      <h3 className="serif" style={{ fontSize: 18, marginBottom: 4 }}>
        Confirm for Italy · <em className="italic ink-soft">Conferma per l&apos;Italia</em>
      </h3>
      <p className="ink-soft" style={{ fontSize: 13, marginBottom: 16 }}>
        These items are in active use in Colorado and marked SHIP-ITALY.
        Review each one before it appears on the customs declaration.
      </p>

      {error && <p className="eval-error-text" style={{ marginBottom: 12 }}>{error}</p>}

      {voltageItems.length > 0 && (
        <>
          <div className="confirm-section-header confirm-section-voltage">
            <span className="confirm-section-icon">⚡</span>
            <span>
              {voltageItems.length} voltage-incompatible · <em className="italic">Voltaggio incompatibile</em>
            </span>
          </div>
          {voltageItems.map(entry => (
            <ConfirmItemCard
              key={entry.id}
              entry={entry}
              condition={conditions[entry.id]}
              onConditionChange={c => setConditions(prev => ({ ...prev, [entry.id]: c }))}
              saving={saving === entry.id}
              isChanging={changingDecision === entry.id}
              settings={settings}
              showVoltageWarning
              onConfirm={() => handleConfirm(entry)}
              onStartChange={() => setChangingDecision(entry.id)}
              onCancelChange={() => setChangingDecision(null)}
              onChangeDecision={d => handleChangeDecision(entry, d)}
              fmtCost={fmtCost}
            />
          ))}
        </>
      )}

      {compatibleItems.length > 0 && (
        <>
          <div className="confirm-section-header">
            <span className="confirm-section-icon">📦</span>
            <span>
              {compatibleItems.length} compatible items · <em className="italic">Articoli compatibili</em>
            </span>
          </div>
          {compatibleItems.length > 1 && (
            <button
              className="btn-secondary confirm-bulk-btn"
              onClick={handleConfirmAllCompatible}
              disabled={saving != null}
            >
              Confirm all compatible · Conferma tutti i compatibili ({compatibleItems.length})
            </button>
          )}
          {compatibleItems.map(entry => (
            <ConfirmItemCard
              key={entry.id}
              entry={entry}
              condition={conditions[entry.id]}
              onConditionChange={c => setConditions(prev => ({ ...prev, [entry.id]: c }))}
              saving={saving === entry.id || saving === -1}
              isChanging={changingDecision === entry.id}
              settings={settings}
              showVoltageWarning={false}
              onConfirm={() => handleConfirm(entry)}
              onStartChange={() => setChangingDecision(entry.id)}
              onCancelChange={() => setChangingDecision(null)}
              onChangeDecision={d => handleChangeDecision(entry, d)}
              fmtCost={fmtCost}
            />
          ))}
        </>
      )}

      {items.length === 0 && (
        <div className="empty-state" style={{ padding: '32px 0' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
          <p className="ink-soft">All active-use items confirmed · Tutti gli articoli in uso confermati</p>
        </div>
      )}
    </div>
  )
}

function ConfirmItemCard({
  entry, condition, onConditionChange, saving, isChanging, settings,
  showVoltageWarning, onConfirm, onStartChange, onCancelChange, onChangeDecision, fmtCost,
}: {
  entry: Entry
  condition: ItemCondition | undefined
  onConditionChange: (c: ItemCondition) => void
  saving: boolean
  isChanging: boolean
  settings: import('../lib/types').CernitaSettings
  showVoltageWarning: boolean
  onConfirm: () => void
  onStartChange: () => void
  onCancelChange: () => void
  onChangeDecision: (d: Decision) => void
  fmtCost: (n: number | null | undefined) => string
}) {
  const savings = entry.net_cost_storage
  const savingsLabel = savings != null && savings >= 0 ? 'Ship saves' : 'Replace saves'

  return (
    <div className="confirm-item-card">
      <div className="confirm-item-header">
        {entry.photo_data && (
          <img src={`data:image/jpeg;base64,${entry.photo_data}`} alt={entry.item_name} className="confirm-item-photo" />
        )}
        <div className="confirm-item-info">
          <p className="confirm-item-name serif">{entry.item_name}</p>
          {entry.item_name_it && <p className="confirm-item-name-it italic ink-soft">{entry.item_name_it}</p>}
          {entry.item_model && <p className="confirm-item-model ink-soft">{entry.item_model}</p>}
        </div>
      </div>

      {showVoltageWarning && (
        <div className="confirm-voltage-warn">
          <span>⚡</span>
          <p>
            110V — incompatible with Italy (220V/50Hz). Ship anyway, or change decision?
            <br /><em className="italic ink-soft">Non compatibile con l&apos;Italia. Spedire comunque o cambiare decisione?</em>
          </p>
        </div>
      )}

      <div className="confirm-economics">
        <div className="confirm-econ-row">
          <span>Total to Italy</span>
          <span className="confirm-econ-value">{fmtCost(entry.net_cost_ship)}</span>
        </div>
        <div className="confirm-econ-row">
          <span>Replace in Italy</span>
          <span className="confirm-econ-value">{fmtCost(entry.replacement_cost)}</span>
        </div>
        {savings != null && (
          <div className={`confirm-econ-row confirm-econ-${savings >= 0 ? 'positive' : 'negative'}`}>
            <span>{savingsLabel}</span>
            <span className="confirm-econ-value">{fmtCost(Math.abs(savings))}</span>
          </div>
        )}
        {entry.weight_lb != null && (
          <div className="confirm-econ-row">
            <span>Weight</span>
            <span className="confirm-econ-value">{entry.weight_lb} lb</span>
          </div>
        )}
      </div>

      <div className="confirm-condition">
        <label className="confirm-condition-label">Condition · <em className="italic ink-soft">Condizioni</em></label>
        <div className="confirm-condition-pills">
          {(Object.keys(CONDITION_LABELS) as ItemCondition[]).map(c => (
            <button key={c} type="button" className={`confirm-condition-pill${condition === c ? ' active' : ''}`} onClick={() => onConditionChange(c)}>
              {CONDITION_LABELS[c].en}
            </button>
          ))}
        </div>
      </div>

      {isChanging ? (
        <div className="confirm-change-actions">
          <p className="confirm-change-label">Change to · <em className="italic ink-soft">Cambia in</em></p>
          <div className="confirm-change-buttons">
            {CHANGE_DECISIONS.map(d => {
              const lbl = getDecisionLabel(d, settings.usDestination, 'COLORADO')
              return (
                <button key={d} className="btn-secondary confirm-change-btn" onClick={() => onChangeDecision(d)} disabled={saving}>
                  {lbl.en}
                </button>
              )
            })}
          </div>
          <button className="btn-link" onClick={onCancelChange} style={{ marginTop: 8 }}>Cancel · Annulla</button>
        </div>
      ) : (
        <div className="confirm-actions">
          <button className="btn-primary confirm-btn" onClick={onConfirm} disabled={saving}>
            {saving ? 'Saving…' : 'Confirm for Italy · Conferma per l\'Italia'}
          </button>
          <button className="btn-link confirm-change-link" onClick={onStartChange} disabled={saving}>
            Change decision · Cambia decisione
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type CustomsView = 'review' | 'incomplete' | 'preview' | 'confirm-italy'

export default function CustomsPage() {
  const { state, dispatch } = useApp()
  const { log: entries, settings, boxes, trips } = state
  const profile = settings.customsProfile ?? DEFAULT_CUSTOMS_PROFILE

  const [view, setView] = useState<CustomsView>('review')
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [shipmentMode, setShipmentMode] = useState<'all' | 'split'>('all')

  // Filter SHIP-ITALY items
  const keepItaly = useMemo(
    () => entries.filter(e => e.final_decision === 'SHIP-ITALY'),
    [entries]
  )

  const completeness = useMemo(() => checkCompleteness(entries, boxes as Box[]), [entries, boxes])

  const activeUseIds = useMemo(
    () => new Set(completeness.activeUseUnconfirmed.map(e => e.id)),
    [completeness.activeUseUnconfirmed]
  )
  const declarable = useMemo(
    () => keepItaly.filter(e => !e.customs_exclude && !activeUseIds.has(e.id)),
    [keepItaly, activeUseIds]
  )

  const grouped = useMemo(() => groupByCategory(declarable), [declarable])

  // Check profile completeness
  const profileComplete = !!(profile.namePrimary && profile.usAddress && (profile.italyAddress || settings.italyAddress))

  // Merge Italy address from settings if profile doesn't have its own
  const effectiveProfile = {
    ...profile,
    italyAddress: profile.italyAddress || settings.italyAddress,
  }

  const canGenerate = profileComplete && completeness.isComplete && declarable.length > 0

  function toggleCat(cat: string) {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  function handleEntryUpdate(entry: Entry) {
    dispatch({ type: 'UPSERT_ENTRY', entry })
  }

  // Generate declaration
  const [previewData, setPreviewData] = useState<{
    coverText: string; rows: GoodsRow[]; totalEur: number
  } | null>(null)

  function handleGenerate() {
    const { rows, totalEur } = generateGoodsTable(declarable, settings.eurRate)
    const coverText = generateCoverDeclaration(
      effectiveProfile,
      declarable.length,
      totalEur,
      'Ocean freight / Trasporto marittimo'
    )
    setPreviewData({ coverText, rows, totalEur })
    setView('preview')
  }

  // Grand total in EUR
  const grandTotalEur = declarable.reduce((sum, e) => {
    const usd = e.replacement_cost ?? e.estimated_resale_value ?? 0
    return sum + usd * settings.eurRate
  }, 0)

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (view === 'preview' && previewData) {
    return (
      <AuthGuard>
        <Head><title>Cernita — Customs Declaration</title></Head>
        <DeclarationPreview
          coverText={previewData.coverText}
          rows={previewData.rows}
          totalEur={previewData.totalEur}
          onClose={() => setView('review')}
        />
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <Head><title>Cernita — Customs</title></Head>
      <div className="app-shell">
        <header style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--paper-dark)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span className="serif" style={{ fontSize: '20px' }}>
            Customs · <em className="ink-soft" style={{ fontStyle: 'italic', fontSize: '16px' }}>Dogana</em>
          </span>
          <SyncIndicator />
        </header>

        <div className="page-content">
          {keepItaly.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 36, marginBottom: 12 }}>🇮🇹</div>
              <h3>No items bound for Italy</h3>
              <p className="italic ink-soft">
                Nessun oggetto destinato all&apos;Italia.
                <br />
                Mark items as SHIP-ITALY to include them in the customs declaration.
              </p>
            </div>
          ) : view === 'confirm-italy' ? (
            <ItalyConfirmationFlow
              items={completeness.activeUseUnconfirmed}
              settings={settings}
              onUpdate={handleEntryUpdate}
              onBack={() => setView('review')}
            />
          ) : view === 'incomplete' ? (
            <IncompleteEditor
              items={[...completeness.missingYear, ...completeness.missingValue, ...completeness.missingItalianName]
                .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)}
              onUpdate={handleEntryUpdate}
              onBack={() => setView('review')}
            />
          ) : (
            <>
              {/* Profile warning */}
              {!profileComplete && (
                <div className="customs-banner customs-banner-warn" style={{ marginBottom: 16 }}>
                  <span style={{ fontSize: 20 }}>📋</span>
                  <div>
                    <p><strong>Declarant profile incomplete</strong></p>
                    <p className="ink-soft" style={{ fontSize: 13 }}>
                      Go to Settings → Customs Declaration to fill in your name, addresses, and port of entry.
                    </p>
                  </div>
                </div>
              )}

              {/* Regulation info */}
              <div className="customs-info">
                <p style={{ fontSize: 13 }}>
                  <strong>EU Reg. 1186/2009, Art. 3</strong> — Duty-free import of personal goods
                  for persons transferring residence from a third country. As US citizens, you qualify
                  under the same exemption — items must be owned 6+ months.
                </p>
                <p className="italic ink-soft" style={{ fontSize: 12, marginTop: 4 }}>
                  Esenzione doganale per beni personali usati da oltre 6 mesi.
                </p>
              </div>

              {/* Active-use unconfirmed banner (spec 016 Part 3) */}
              {completeness.activeUseUnconfirmed.length > 0 && (
                <div className="customs-banner customs-banner-active-use" style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>🏠</span>
                  <div>
                    <p>
                      <strong>{completeness.activeUseUnconfirmed.length} active-use item{completeness.activeUseUnconfirmed.length !== 1 ? 's' : ''} not yet confirmed for Italy</strong>
                    </p>
                    <p className="ink-soft" style={{ fontSize: 13 }}>
                      Items in active use in Colorado are excluded from the declaration until re-confirmed.
                    </p>
                    <p className="italic ink-soft" style={{ fontSize: 12, marginTop: 2 }}>
                      Articoli in uso attivo in Colorado esclusi fino alla conferma.
                    </p>
                    <button className="btn-link" style={{ marginTop: 6 }} onClick={() => setView('confirm-italy')}>
                      Review · Rivedi
                    </button>
                  </div>
                </div>
              )}

              {/* Completeness */}
              <CompletenessBanner
                total={completeness.total}
                missingYear={completeness.missingYear.length}
                missingValue={completeness.missingValue.length}
                missingItalianName={completeness.missingItalianName.length}
                excluded={completeness.excluded.length}
                onShowIncomplete={() => setView('incomplete')}
              />

              {/* Summary */}
              <div className="customs-summary">
                <div className="customs-summary-item">
                  <span className="customs-summary-value">{declarable.length}</span>
                  <span className="customs-summary-label">Items · Articoli</span>
                </div>
                <div className="customs-summary-item">
                  <span className="customs-summary-value">{fmtEur(grandTotalEur)}</span>
                  <span className="customs-summary-label">Total · Totale</span>
                </div>
                <div className="customs-summary-item">
                  <span className="customs-summary-value">{settings.eurRate}</span>
                  <span className="customs-summary-label">EUR/USD</span>
                </div>
              </div>

              {/* Category groups */}
              <h3 className="section-header" style={{ marginTop: 20, marginBottom: 12 }}>
                Items by category · <em className="italic ink-soft">Per categoria</em>
              </h3>

              {Array.from(grouped.entries()).map(([cat, items]) => (
                <CategoryGroup
                  key={cat}
                  category={cat}
                  items={items}
                  eurRate={settings.eurRate}
                  expanded={expandedCats.has(cat)}
                  onToggle={() => toggleCat(cat)}
                />
              ))}

              {/* Generate button */}
              <div style={{ marginTop: 24 }}>
                <button
                  className="btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                >
                  Generate declaration · Genera dichiarazione
                </button>
                {!canGenerate && (
                  <p className="ink-soft" style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                    {!profileComplete && 'Complete your declarant profile in Settings. '}
                    {!completeness.isComplete && 'All items must have acquisition year, value, and Italian name. '}
                    {declarable.length === 0 && 'No SHIP-ITALY items to declare.'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <Nav />
      </div>
    </AuthGuard>
  )
}
