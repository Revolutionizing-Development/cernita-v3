import Head from 'next/head'
import { useState, useMemo } from 'react'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import SyncIndicator from '../components/SyncIndicator'
import { useApp } from '../lib/context'
import { supabase } from '../lib/supabase'
import haptic from '../lib/haptic'
import {
  Entry, CustomsCategory, CUSTOMS_CATEGORY_LABELS, DEFAULT_CUSTOMS_PROFILE,
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type CustomsView = 'review' | 'incomplete' | 'preview'

export default function CustomsPage() {
  const { state, dispatch } = useApp()
  const { log: entries, settings, boxes, trips } = state
  const profile = settings.customsProfile ?? DEFAULT_CUSTOMS_PROFILE

  const [view, setView] = useState<CustomsView>('review')
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [shipmentMode, setShipmentMode] = useState<'all' | 'split'>('all')

  // Filter KEEP-ITALY items
  const keepItaly = useMemo(
    () => entries.filter(e => e.final_decision === 'KEEP-ITALY'),
    [entries]
  )

  const declarable = useMemo(
    () => keepItaly.filter(e => !e.customs_exclude),
    [keepItaly]
  )

  const completeness = useMemo(() => checkCompleteness(entries), [entries])
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
                Mark items as KEEP-ITALY to include them in the customs declaration.
              </p>
            </div>
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
                    {declarable.length === 0 && 'No KEEP-ITALY items to declare.'}
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
