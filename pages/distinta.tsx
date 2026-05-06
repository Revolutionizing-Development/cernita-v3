import Head from 'next/head'
import AuthGuard from '../components/AuthGuard'
import { useApp } from '../lib/context'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(n: number | null | undefined): string {
  if (n == null) return 'N/D'
  return `$ ${Math.round(Math.abs(n)).toLocaleString('it-IT')}`
}

function fmtEUR(n: number | null | undefined, rate: number): string {
  if (n == null) return 'N/D'
  return `€ ${Math.round(Math.abs(n) * rate).toLocaleString('it-IT')}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DistitaPage() {
  const { state } = useApp()
  const { log: entries, settings, user } = state

  // Only KEEP-ITALY items
  const items = [...entries]
    .filter(e => e.final_decision === 'KEEP-ITALY')
    .sort((a, b) => (a.item_name_it ?? a.item_name).localeCompare(b.item_name_it ?? b.item_name, 'it'))

  const totalUSD = items.reduce((s, e) => s + (e.replacement_cost ?? e.estimated_resale_value ?? 0), 0)
  const totalEUR = Math.round(totalUSD * settings.eurRate)

  const declarant = user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? '—'
  const today = new Date().toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  return (
    <AuthGuard>
      <Head><title>Distinta Doganale — Cernita</title></Head>

      <div className="distinta-page">

        {/* ── Screen toolbar ── */}
        <div className="distinta-toolbar no-print">
          <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => window.close()}>
            ✕ Close
          </button>
          <span className="serif" style={{ fontSize: 16 }}>Distinta doganale</span>
          <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => window.print()}>
            ◫ Stampa · Print
          </button>
        </div>

        {/* ── Official document ── */}
        <div className="distinta-doc">

          {/* Header */}
          <div className="distinta-header">
            <h1 className="distinta-title">
              Distinta valorizzata degli effetti personali usati
            </h1>
            <p className="distinta-subtitle">
              per il trasferimento di residenza ai sensi del D.P.R. n. 43/1973 e s.m.i.
              <br />
              <em style={{ fontSize: 11, color: '#666' }}>
                Household goods inventory for change of residence — Italian customs declaration
              </em>
            </p>
          </div>

          {/* Declarant block */}
          <div className="distinta-declarant">
            <div className="distinta-field-row">
              <div className="distinta-field">
                <span className="distinta-field-label">Dichiarante / Declarant</span>
                <span className="distinta-field-value">{declarant}</span>
              </div>
              <div className="distinta-field">
                <span className="distinta-field-label">Data / Date</span>
                <span className="distinta-field-value">{today}</span>
              </div>
            </div>
            <div className="distinta-field-row">
              <div className="distinta-field">
                <span className="distinta-field-label">Provenienza / Origin</span>
                <span className="distinta-field-value">Illinois, USA</span>
              </div>
              <div className="distinta-field">
                <span className="distinta-field-label">Destinazione / Destination</span>
                <span className="distinta-field-value">Italia</span>
              </div>
            </div>
            <div className="distinta-field-row">
              <div className="distinta-field" style={{ flex: 1 }}>
                <span className="distinta-field-label">Modalità di trasporto / Shipping method</span>
                <span className="distinta-field-value">Contenitore marittimo / Ocean container</span>
              </div>
            </div>
          </div>

          {/* Item table */}
          {items.length === 0 ? (
            <p className="distinta-empty">
              Nessun oggetto destinato all&apos;Italia. Valutare gli oggetti nella scheda &quot;Evaluate&quot;
              e scegliere &quot;Keep — ship to Italy&quot;.
            </p>
          ) : (
            <table className="distinta-table">
              <thead>
                <tr>
                  <th className="distinta-th-num">N.</th>
                  <th className="distinta-th-desc">Descrizione dell&apos;oggetto</th>
                  <th className="distinta-th-ref">Riferimento (EN)</th>
                  <th className="distinta-th-cond">Condiz.</th>
                  <th className="distinta-th-val">Valore (USD)</th>
                  <th className="distinta-th-val">Valore (EUR)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e, i) => {
                  const val = e.replacement_cost ?? e.estimated_resale_value
                  return (
                    <tr key={e.id} className={`distinta-row ${i % 2 === 1 ? 'distinta-row-alt' : ''}`}>
                      <td className="distinta-cell-num">{i + 1}</td>
                      <td className="distinta-cell-desc">
                        <div className="distinta-item-name">{e.item_name_it ?? e.item_name}</div>
                        {e.item_model && (
                          <div className="distinta-item-model">{e.item_model}</div>
                        )}
                      </td>
                      <td className="distinta-cell-ref">{e.item_name}</td>
                      <td className="distinta-cell-cond">Usato</td>
                      <td className="distinta-cell-val">{fmtUSD(val)}</td>
                      <td className="distinta-cell-val">{fmtEUR(val, settings.eurRate)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="distinta-total-row">
                  <td colSpan={4} className="distinta-total-label">
                    Valore totale dichiarato / Total declared value
                  </td>
                  <td className="distinta-cell-val distinta-total-val">
                    {fmtUSD(totalUSD)}
                  </td>
                  <td className="distinta-cell-val distinta-total-val">
                    {`€ ${totalEUR.toLocaleString('it-IT')}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* Declaration statement */}
          <div className="distinta-declaration">
            <p>
              Il/La sottoscritto/a dichiara sotto la propria responsabilità che tutti gli effetti
              personali elencati nella presente distinta sono stati di sua proprietà e utilizzati
              nel Paese di provenienza (USA) per un periodo non inferiore a sei mesi prima del
              trasferimento di residenza in Italia, e che non sono destinati ad attività
              commerciali.
            </p>
            <p style={{ marginTop: 8, fontSize: 11, color: '#666', fontStyle: 'italic' }}>
              The undersigned declares under their own responsibility that all personal effects
              listed in this inventory have been in their possession and used in the country of
              origin (USA) for at least six months prior to the change of residence to Italy,
              and are not intended for commercial purposes.
            </p>
            <p className="distinta-disclaimer">
              * I valori indicati sono stime in USD basate sul costo di sostituzione a nuovo.
              Il cambio EUR/USD applicato è {settings.eurRate.toFixed(2)}.
              <br />
              * Values are USD replacement-cost estimates. EUR/USD rate applied: {settings.eurRate.toFixed(2)}.
            </p>
          </div>

          {/* Signature block */}
          <div className="distinta-signature">
            <div className="distinta-sig-field">
              <span className="distinta-sig-label">Luogo e data / Place and date</span>
              <div className="distinta-sig-line" />
            </div>
            <div className="distinta-sig-field">
              <span className="distinta-sig-label">Firma del dichiarante / Declarant&apos;s signature</span>
              <div className="distinta-sig-line" />
            </div>
          </div>

          {/* Footer */}
          <div className="distinta-footer">
            <span>Generato con Cernita · {today}</span>
            <span>{items.length} oggetti · {items.length} items</span>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
