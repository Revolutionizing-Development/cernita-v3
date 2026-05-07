import Head from 'next/head'
import { useState } from 'react'
import { useRouter } from 'next/router'
import AuthGuard from '../components/AuthGuard'
import Nav from '../components/Nav'
import { useApp } from '../lib/context'
import { supabase } from '../lib/supabase'
import { exportCSV } from '../lib/exportCsv'
import { recomputeCosts } from '../lib/costs'
import {
  Location, DEFAULT_CUSTOMS_PROFILE, CustomsDeclarantProfile,
  DecisionRule, RuleCondition, RuleField, RuleOperator, RuleSuggestion,
  Decision, ActionPhase, DECISION_LABELS, DECISION_BADGE_CLASS,
  RULE_FIELD_LABELS, RULE_OPERATOR_LABELS,
  getDecisionLabel, getOperatorsForField, getFieldValueType,
  CUSTOMS_CATEGORY_LABELS, CustomsCategory,
} from '../lib/types'
import { suggestRules, formatRuleSummary, formatCondition } from '../lib/rules'

export default function SettingsPage() {
  const { state, dispatch } = useApp()
  const router = useRouter()
  const { user, settings } = state

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function updateSetting<K extends keyof typeof settings>(key: K, value: typeof settings[K]) {
    dispatch({ type: 'SET_SETTINGS', settings: { ...settings, [key]: value } })
  }

  // Bump rulesVersion whenever a rate changes so the outdated-badge logic fires
  function updateRate<K extends keyof typeof settings>(key: K, value: typeof settings[K]) {
    const [major, minor, patch] = settings.rulesVersion.split('.').map(Number)
    const nextVersion = `${major}.${minor}.${patch + 1}`
    dispatch({
      type: 'SET_SETTINGS',
      settings: { ...settings, [key]: value, rulesVersion: nextVersion },
    })
  }

  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  function handleExportCSV() {
    exportCSV(state.log)
    showToast(`${state.log.length} items exported · File esportato`)
  }

  async function handleRederiveAll() {
    // Re-compute costs for every outdated entry using current rules (local math, no AI call)
    const { log, settings } = state
    const outdated = log.filter(e => e.rules_version && e.rules_version !== settings.rulesVersion)
    if (outdated.length === 0) {
      showToast('All entries are current · Tutto aggiornato')
      return
    }

    showToast(`Re-deriving ${outdated.length} entries… · Ricalcolo in corso…`)

    let updated = 0
    let failed = 0

    for (const entry of outdated) {
      const costs = recomputeCosts(entry, settings)
      const { data, error } = await supabase
        .from('cernita_entries')
        .update({
          ...costs,
          rules_version: settings.rulesVersion,
          rules_snapshot: settings as unknown as Record<string, unknown>,
        })
        .eq('id', entry.id)
        .select()
        .single()

      if (error) {
        failed++
        console.error(`Re-derive failed for entry ${entry.id}:`, error)
      } else if (data) {
        updated++
        dispatch({ type: 'UPSERT_ENTRY', entry: data })
      }
    }

    if (failed > 0) {
      showToast(`${updated} updated, ${failed} failed · ${updated} aggiornate, ${failed} errori`)
    } else {
      showToast(`${updated} entries updated to v${settings.rulesVersion} · Aggiornate`)
    }
  }

  const displayName = user?.user_metadata?.display_name ?? user?.email ?? 'User'

  return (
    <AuthGuard>
      <Head><title>Cernita — Settings</title></Head>
      <div className="app-shell">
        <header style={{ padding: '12px 16px', borderBottom: '1px solid var(--paper-dark)' }}>
          <span className="serif" style={{ fontSize: '20px' }}>Settings · <em className="ink-soft" style={{ fontStyle: 'italic' }}>Impostazioni</em></span>
        </header>

        {toast && <div className="toast">{toast}</div>}

        <div className="page-content">

          {/* ── Identity ── */}
          <div className="card" style={{ marginBottom: 24 }}>
            <p style={{ fontWeight: 600, marginBottom: 2 }}>{displayName}</p>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 14 }}>{user?.email}</p>
            <button className="btn-destructive" onClick={handleSignOut}>
              Esci · Sign out
            </button>
          </div>

          {/* ── Move route ── */}
          <h2 className="section-header">
            Move route · <em className="italic ink-soft">Percorso</em>
          </h2>
          <div className="card" style={{ marginBottom: 24 }}>
            <p className="settings-hint">
              Illinois → <strong>{settings.usDestination}</strong> → Italy
              <br />
              <em className="ink-soft" style={{ fontSize: 12 }}>
                Items move by truck to {settings.usDestination}, live in the house for ~2 years, then ship to Italy by ocean freight.
              </em>
            </p>
            <div style={{ marginTop: 14 }}>
              <label className="input-label">US intermediate city · Città di sosta USA</label>
              <input
                type="text"
                className="input"
                value={settings.usDestination}
                onChange={e => updateSetting('usDestination', e.target.value)}
                placeholder="e.g. Colorado Springs"
              />
            </div>
          </div>

          {/* ── Rates ── */}
          <h2 className="section-header">
            Rates · <em className="italic ink-soft">Tariffe</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Changing a rate bumps the rules version (v{settings.rulesVersion}) and marks
            older entries as outdated in the Log.
          </p>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p className="input-label" style={{ fontWeight: 600, marginBottom: -8 }}>
                Leg 1 — Ground move (IL → {settings.usDestination})
              </p>
              <div>
                <label className="input-label">Moving rate — $/lb · Costo trasloco</label>
                <input
                  type="number"
                  className="input"
                  step="0.01"
                  min="0"
                  value={settings.movingRatePerLb}
                  onChange={e => updateRate('movingRatePerLb', parseFloat(e.target.value) || 0)}
                />
                <p className="settings-hint" style={{ marginTop: 4 }}>
                  Per-pound share of the moving truck (~1,000 miles). Default: $0.50/lb
                </p>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--paper-dark)', margin: '4px 0' }} />
              <p className="input-label" style={{ fontWeight: 600, marginBottom: -8 }}>
                Leg 2 — Ocean shipping ({settings.usDestination} → Italy)
              </p>
              <div>
                <label className="input-label">Ocean shipping — $/lb</label>
                <input
                  type="number"
                  className="input"
                  step="0.01"
                  min="0"
                  value={settings.shippingRatePerLb}
                  onChange={e => updateRate('shippingRatePerLb', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="input-label">Ocean shipping — $/cu ft</label>
                <input
                  type="number"
                  className="input"
                  step="0.01"
                  min="0"
                  value={settings.shippingRatePerCuFt}
                  onChange={e => updateRate('shippingRatePerCuFt', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* ── Currency ── */}
          <h2 className="section-header">
            Currency · <em className="italic ink-soft">Valuta</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            EUR/USD rate used for the Italian customs distinta. Update before generating the document.
          </p>
          <div className="card" style={{ marginBottom: 24 }}>
            <label className="input-label">EUR / USD exchange rate · Cambio EUR/USD</label>
            <input
              type="number"
              className="input"
              step="0.01"
              min="0.1"
              value={settings.eurRate}
              onChange={e => updateSetting('eurRate', parseFloat(e.target.value) || 0.92)}
            />
            <p className="settings-hint" style={{ marginTop: 6 }}>
              e.g. 0.92 means $1 = €0.92 · Default: 0.92
            </p>
          </div>

          {/* ── Italian destination ── */}
          <h2 className="section-header">
            Italian destination · <em className="italic ink-soft">Destinazione italiana</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Printed on customs-compliant box labels as the consignee address.
            Italian customs requires the full address (street, CAP, city, province).
          </p>
          <div className="card" style={{ marginBottom: 24 }}>
            <label className="input-label">Full Italian address · Indirizzo completo</label>
            <textarea
              className="input"
              rows={4}
              style={{ resize: 'vertical', fontFamily: 'var(--font-sans)' }}
              value={settings.italyAddress}
              onChange={e => updateSetting('italyAddress', e.target.value)}
              placeholder={`Via Example 42\n05059 Todi (PG)\nUmbria`}
            />
            <p className="settings-hint" style={{ marginTop: 6 }}>
              Example: Via Roma 42 · 05059 Todi (PG) · Umbria
            </p>
          </div>

          {/* ── Motion ── */}
          <h2 className="section-header">
            Animations · <em className="italic ink-soft">Animazioni</em>
          </h2>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: 2, fontSize: 14 }}>Motion &amp; haptics</p>
                <p className="settings-hint">
                  Count-up numbers, staggered lists, spring-back taps, and vibration feedback.
                  <br />
                  <em className="ink-soft" style={{ fontSize: 11 }}>Turn off to revert to no-motion mode.</em>
                </p>
              </div>
              <label className="toggle-switch" style={{ flexShrink: 0, marginLeft: 16 }}>
                <input
                  type="checkbox"
                  checked={settings.motionEnabled}
                  onChange={e => updateSetting('motionEnabled', e.target.checked)}
                />
                <span className="toggle-track">
                  <span className="toggle-thumb" />
                </span>
              </label>
            </div>
          </div>

          {/* ── Perspective thresholds ── */}
          <h2 className="section-header">
            Perspective tuning · <em className="italic ink-soft">Regolazione prospettive</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Two lenses evaluate every item: one focused on replacement cost, the other on shipping cost.
            When they disagree, the item is flagged for discussion.
            <br />
            <em className="italic ink-soft">
              Due prospettive valutano ogni oggetto: una sul costo di sostituzione, l&apos;altra sul costo di spedizione.
              Quando discordano, l&apos;oggetto viene segnalato per la discussione.
            </em>
          </p>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p className="input-label" style={{ fontWeight: 600, marginBottom: -8 }}>Ship perspective (replacement-cost lens)</p>
              <div>
                <label className="input-label">Ship if replacement &gt; ship cost × this factor</label>
                <input
                  type="number"
                  className="input"
                  step="0.1"
                  min="1"
                  value={settings.perspectiveShipThreshold}
                  onChange={e => updateSetting('perspectiveShipThreshold', parseFloat(e.target.value) || 1.5)}
                />
                <p className="settings-hint" style={{ marginTop: 4 }}>Default: 1.5 — ship if replacement is 50%+ more than shipping</p>
              </div>
              <div>
                <label className="input-label">Sell if replacement &lt; ship cost × this factor</label>
                <input
                  type="number"
                  className="input"
                  step="0.1"
                  min="0"
                  max="1"
                  value={settings.perspectiveSellThreshold}
                  onChange={e => updateSetting('perspectiveSellThreshold', parseFloat(e.target.value) || 0.5)}
                />
                <p className="settings-hint" style={{ marginTop: 4 }}>Default: 0.5 — sell if replacement is less than half the shipping cost</p>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--paper-dark)', margin: '4px 0' }} />
              <p className="input-label" style={{ fontWeight: 600, marginBottom: -8 }}>Save perspective (shipping-cost lens)</p>
              <div>
                <label className="input-label">Ship if ship cost &lt; replacement × this factor</label>
                <input
                  type="number"
                  className="input"
                  step="0.1"
                  min="0"
                  max="1"
                  value={settings.perspectiveSaveShipThreshold}
                  onChange={e => updateSetting('perspectiveSaveShipThreshold', parseFloat(e.target.value) || 0.3)}
                />
                <p className="settings-hint" style={{ marginTop: 4 }}>Default: 0.3 — ship if shipping is less than 30% of replacement</p>
              </div>
              <div>
                <label className="input-label">Sell if ship cost &gt; replacement × this factor</label>
                <input
                  type="number"
                  className="input"
                  step="0.1"
                  min="0"
                  value={settings.perspectiveSaveSellThreshold}
                  onChange={e => updateSetting('perspectiveSaveSellThreshold', parseFloat(e.target.value) || 0.7)}
                />
                <p className="settings-hint" style={{ marginTop: 4 }}>Default: 0.7 — sell if shipping is more than 70% of replacement</p>
              </div>
            </div>
          </div>

          {/* ── Decision rules ── */}
          <h2 className="section-header">
            Decision rules · <em className="italic ink-soft">Regole di decisione</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Rules override AI suggestions when they match an item. The AI's recommendation is still shown as an alternative.
            <br />
            <em className="italic ink-soft">
              Le regole prevalgono sui suggerimenti AI quando corrispondono. Il suggerimento AI viene comunque mostrato come alternativa.
            </em>
          </p>
          <div className="card" style={{ marginBottom: 24 }}>
            <DecisionRulesManager
              rules={settings.decisionRules ?? []}
              entries={state.log}
              onChange={(rules) => updateSetting('decisionRules', rules)}
              usDestination={settings.usDestination}
            />
          </div>

          {/* ── AI model ── */}
          <h2 className="section-header">
            AI model · <em className="italic ink-soft">Modello AI</em>
          </h2>
          <div className="card" style={{ marginBottom: 24 }}>
            <select
              className="input"
              value={settings.aiModel}
              onChange={e => updateSetting('aiModel', e.target.value)}
            >
              <option value="claude-sonnet-4-5">Claude Sonnet 4.5 — Balanced (recommended)</option>
              <option value="claude-opus-4-5">Claude Opus 4.5 — Most thorough (slower)</option>
              <option value="claude-haiku-3-5-20241022">Claude Haiku 3.5 — Fastest</option>
            </select>
          </div>

          {/* ── Trip / suitcase defaults ── */}
          <h2 className="section-header">
            Trip bag limits · <em className="italic ink-soft">Limiti bagagli</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Default weight limits used when creating suitcases. Override per-bag on the Trips page.
          </p>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="input-label">Checked bag limit (lb) · Bagaglio da stiva</label>
                <input
                  type="number"
                  className="input"
                  step="1"
                  min="0"
                  value={settings.checkedBagLimitLb}
                  onChange={e => updateSetting('checkedBagLimitLb', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="input-label">Carry-on limit (lb) · Bagaglio a mano</label>
                <input
                  type="number"
                  className="input"
                  step="1"
                  min="0"
                  value={settings.carryOnLimitLb}
                  onChange={e => updateSetting('carryOnLimitLb', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="input-label">Personal item limit (lb) · Oggetto personale</label>
                <input
                  type="number"
                  className="input"
                  step="1"
                  min="0"
                  value={settings.personalItemLimitLb}
                  onChange={e => updateSetting('personalItemLimitLb', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* ── Locations ── */}
          <h2 className="section-header">
            Locations · <em className="italic ink-soft">Posizioni</em>
          </h2>
          <div className="card" style={{ marginBottom: 24 }}>
            <LocationsManager />
          </div>

          {/* ── Customs declaration profile ── */}
          <h2 className="section-header">
            Customs declaration · <em className="italic ink-soft">Dichiarazione doganale</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Declarant details for the Italian customs exemption under EU Reg. 1186/2009.
            As US citizens, you qualify for duty-free import of personal goods owned 6+ months.
          </p>
          <CustomsProfileEditor
            profile={settings.customsProfile ?? DEFAULT_CUSTOMS_PROFILE}
            italyAddressFallback={settings.italyAddress}
            onChange={(p) => updateSetting('customsProfile', p)}
          />

          {/* ── Documents ── */}
          <h2 className="section-header">
            Documents · <em className="italic ink-soft">Documenti</em>
          </h2>
          <p className="settings-hint" style={{ marginBottom: 12 }}>
            Print-to-PDF documents for customs, insurance, and shipping records.
          </p>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a
                href="/customs"
                className="btn-secondary"
                style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}
              >
                🇮🇹 Customs declaration · <em className="italic">Dichiarazione doganale</em>
                {state.log.filter(e => e.final_decision === 'SHIP-ITALY').length > 0 && (
                  <span className="ink-soft" style={{ fontSize: 11, marginLeft: 8 }}>
                    ({state.log.filter(e => e.final_decision === 'SHIP-ITALY').length} SHIP-ITALY items)
                  </span>
                )}
              </a>
              <a
                href="/export/inventory"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}
              >
                📄 Inventory with photos · <em className="italic">Inventario con foto</em>
                {state.log.length > 0 && (
                  <span className="ink-soft" style={{ fontSize: 11, marginLeft: 8 }}>
                    ({state.log.length} items)
                  </span>
                )}
              </a>
              <a
                href="/distinta"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}
              >
                🇮🇹 Distinta doganale italiana · <em className="italic">Italian customs distinta (legacy)</em>
              </a>
              <a
                href="/labels"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ textAlign: 'center', textDecoration: 'none', display: 'block' }}
              >
                🏷 Etichette scatole · <em className="italic">Box labels (customs-compliant)</em>
                {state.boxes.filter(b => b.destination === 'SHIP-ITALY').length > 0 && (
                  <span className="ink-soft" style={{ fontSize: 11, marginLeft: 8 }}>
                    ({state.boxes.filter(b => b.destination === 'SHIP-ITALY').length} Italy-bound boxes)
                  </span>
                )}
              </a>
            </div>
          </div>

          {/* ── Maintenance ── */}
          <h2 className="section-header">
            Maintenance · <em className="italic ink-soft">Manutenzione</em>
          </h2>
          <div className="card" style={{ background: 'var(--paper-dark)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn-secondary" onClick={handleExportCSV}>
                Export CSV · <em className="italic">Esporta CSV</em>
                {state.log.length > 0 && (
                  <span className="ink-soft" style={{ fontSize: 11, marginLeft: 8 }}>
                    ({state.log.length} items)
                  </span>
                )}
              </button>
              <button className="btn-secondary" onClick={handleRederiveAll}>
                Re-derive outdated entries · <em className="italic">Rideriva voci obsolete</em>
              </button>
            </div>
          </div>

          <p className="settings-version">Rules v{settings.rulesVersion}</p>

          {/* ── Data deletion (Constitution P3) ── */}
          <h2 className="section-header" style={{ marginTop: 32 }}>
            Data · <em className="italic ink-soft">Dati</em>
          </h2>
          <DataDeletion />

        </div>
        <Nav />
      </div>
    </AuthGuard>
  )
}

// ─── DecisionRulesManager ─────────────────────────────────────────────────────

const VALID_DECISIONS: Decision[] = [
  'SHIP-ITALY', 'SELL', 'DONATE', 'DISPOSE', 'GIVE-FAMILY', 'CONSUME', 'NEEDS-HUMAN',
]
const PHASED_DECISIONS: Decision[] = ['SELL', 'DONATE', 'CONSUME']
const ALL_RULE_FIELDS: RuleField[] = [
  'customs_category', 'replacement_cost', 'ship_cost', 'net_cost_ship',
  'weight_lb', 'voltage_incompatible', 'shipping_restriction', 'fragility', 'oversized',
]

function DecisionRulesManager({
  rules,
  entries,
  onChange,
  usDestination,
}: {
  rules: DecisionRule[]
  entries: import('../lib/types').Entry[]
  onChange: (rules: DecisionRule[]) => void
  usDestination: string
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)

  const sorted = [...rules].sort((a, b) => a.priority - b.priority)
  const suggestions = suggestRules(entries, rules)

  function toggleRule(id: string) {
    onChange(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  function deleteRule(id: string) {
    onChange(rules.filter(r => r.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function saveRule(rule: DecisionRule) {
    const exists = rules.some(r => r.id === rule.id)
    if (exists) {
      onChange(rules.map(r => r.id === rule.id ? rule : r))
    } else {
      onChange([...rules, rule])
    }
    setEditingId(null)
    setShowAdd(false)
  }

  function acceptSuggestion(suggestion: RuleSuggestion) {
    const accepted = {
      ...suggestion.rule,
      acceptedAt: new Date().toISOString(),
    }
    onChange([...rules, accepted])
  }

  function dismissSuggestion(suggestion: RuleSuggestion) {
    // Add a disabled version so it doesn't get suggested again
    const dismissed: DecisionRule = {
      ...suggestion.rule,
      enabled: false,
      acceptedAt: null,
    }
    onChange([...rules, dismissed])
  }

  return (
    <div>
      {/* Existing rules */}
      {sorted.length === 0 && !showAdd && suggestions.length === 0 && (
        <p className="settings-hint" style={{ marginBottom: 12 }}>
          No rules yet. Add a rule or evaluate enough items to get suggestions.
        </p>
      )}

      {sorted.map(rule => {
        const lbl = getDecisionLabel(rule.defaultDecision, usDestination, rule.defaultPhase)
        const badgeClass = DECISION_BADGE_CLASS[rule.defaultDecision] ?? 'badge'
        const isEditing = editingId === rule.id

        if (isEditing) {
          return (
            <RuleEditor
              key={rule.id}
              rule={rule}
              usDestination={usDestination}
              onSave={saveRule}
              onCancel={() => setEditingId(null)}
              onDelete={() => deleteRule(rule.id)}
            />
          )
        }

        return (
          <div key={rule.id} className="rule-row">
            <label className="rule-toggle">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={() => toggleRule(rule.id)}
              />
            </label>
            <div className={`rule-info${rule.enabled ? '' : ' rule-disabled'}`}>
              <div className="rule-name-row">
                <span className="rule-name">{rule.name}</span>
                <span className={`${badgeClass} badge-inline`}>{lbl.en}</span>
              </div>
              <p className="rule-conditions">{formatRuleSummary(rule)}</p>
              {rule.createdBy === 'suggested' && (
                <span className="rule-source">Suggested · Suggerita</span>
              )}
            </div>
            <button
              className="rule-edit-btn"
              onClick={() => setEditingId(rule.id)}
              aria-label="Edit rule"
            >
              ✎
            </button>
          </div>
        )
      })}

      {/* Suggestions from override patterns */}
      {suggestions.length > 0 && showSuggestions && (
        <div className="rule-suggestions">
          <p className="rule-suggestions-label">
            Suggested rules · <em className="italic">Regole suggerite</em>
          </p>
          <p className="settings-hint" style={{ marginBottom: 10 }}>
            Based on your override patterns:
          </p>
          {suggestions.map(s => {
            const lbl = getDecisionLabel(s.rule.defaultDecision, usDestination, s.rule.defaultPhase)
            return (
              <div key={s.rule.id} className="rule-suggestion-card">
                <p className="rule-suggestion-evidence">
                  You changed {s.evidence.matchCount} items to{' '}
                  <strong>{lbl.en}</strong>
                  {s.evidence.commonTags.length > 0 && (
                    <span> (tagged: {s.evidence.commonTags.join(', ')})</span>
                  )}
                </p>
                <p className="rule-suggestion-name">
                  Suggested: <strong>{s.rule.name}</strong>
                </p>
                <p className="rule-conditions">{formatRuleSummary(s.rule)}</p>
                <p className="rule-suggestion-examples ink-soft">
                  e.g. {s.evidence.exampleItems.join(', ')}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => dismissSuggestion(s)}
                  >
                    Dismiss
                  </button>
                  <button
                    className="btn-primary"
                    style={{ flex: 2 }}
                    onClick={() => acceptSuggestion(s)}
                  >
                    Accept · Accetta
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add rule / editor */}
      {showAdd ? (
        <RuleEditor
          rule={null}
          usDestination={usDestination}
          onSave={saveRule}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          className="btn-secondary"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => setShowAdd(true)}
        >
          + Add rule · Aggiungi regola
        </button>
      )}
    </div>
  )
}

// ─── RuleEditor ──────────────────────────────────────────────────────────────

function RuleEditor({
  rule,
  usDestination,
  onSave,
  onCancel,
  onDelete,
}: {
  rule: DecisionRule | null
  usDestination: string
  onSave: (rule: DecisionRule) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const isNew = rule === null
  const [name, setName] = useState(rule?.name ?? '')
  const [decision, setDecision] = useState<Decision>(rule?.defaultDecision ?? 'SELL')
  const [phase, setPhase] = useState<ActionPhase | null>(rule?.defaultPhase ?? null)
  const [conditions, setConditions] = useState<RuleCondition[]>(rule?.conditions ?? [])
  const [priority, setPriority] = useState(rule?.priority ?? 50)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function addCondition() {
    setConditions([...conditions, { field: 'voltage_incompatible', operator: 'eq', value: true }])
  }

  function updateCondition(index: number, cond: RuleCondition) {
    setConditions(conditions.map((c, i) => i === index ? cond : c))
  }

  function removeCondition(index: number) {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  function handleSave() {
    if (!name.trim() || conditions.length === 0) return
    onSave({
      id: rule?.id ?? crypto.randomUUID(),
      name: name.trim(),
      conditions,
      defaultDecision: decision,
      defaultPhase: PHASED_DECISIONS.includes(decision) ? phase : null,
      priority,
      enabled: rule?.enabled ?? true,
      createdBy: rule?.createdBy ?? 'user',
      acceptedAt: rule?.acceptedAt ?? null,
    })
  }

  return (
    <div className="rule-editor">
      <p className="rule-editor-title">
        {isNew ? 'New rule · Nuova regola' : 'Edit rule · Modifica regola'}
      </p>

      {/* Name */}
      <label className="input-label">Name · Nome</label>
      <input
        className="input"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Voltage items → Sell in Colorado"
        style={{ marginBottom: 12 }}
      />

      {/* Decision */}
      <label className="input-label">Decision · Decisione</label>
      <select
        className="input"
        value={decision}
        onChange={e => {
          const d = e.target.value as Decision
          setDecision(d)
          if (PHASED_DECISIONS.includes(d) && !phase) setPhase('NOW')
          if (!PHASED_DECISIONS.includes(d)) setPhase(null)
        }}
        style={{ marginBottom: PHASED_DECISIONS.includes(decision) ? 8 : 12 }}
      >
        {VALID_DECISIONS.map(d => {
          const lbl = getDecisionLabel(d, usDestination)
          return <option key={d} value={d}>{lbl.en} · {lbl.it}</option>
        })}
      </select>

      {PHASED_DECISIONS.includes(decision) && (
        <div className="phase-picker" style={{ marginBottom: 12 }}>
          <button
            className={`phase-pill${phase === 'NOW' ? ' active' : ''}`}
            onClick={() => setPhase('NOW')}
            type="button"
          >Now · Ora</button>
          <button
            className={`phase-pill${phase === 'COLORADO' ? ' active' : ''}`}
            onClick={() => setPhase('COLORADO')}
            type="button"
          >Colorado</button>
        </div>
      )}

      {/* Priority */}
      <label className="input-label">Priority (lower = first) · Priorità</label>
      <input
        type="number"
        className="input"
        value={priority}
        onChange={e => setPriority(parseInt(e.target.value) || 50)}
        min={1}
        max={999}
        style={{ marginBottom: 12 }}
      />

      {/* Conditions */}
      <label className="input-label">Conditions (all must match) · Condizioni</label>
      {conditions.map((cond, idx) => (
        <ConditionRow
          key={idx}
          condition={cond}
          onChange={(c) => updateCondition(idx, c)}
          onRemove={() => removeCondition(idx)}
        />
      ))}
      <button
        className="btn-link"
        onClick={addCondition}
        style={{ marginBottom: 14, fontSize: 13 }}
        type="button"
      >
        + Add condition · Aggiungi condizione
      </button>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-primary"
          style={{ flex: 2 }}
          onClick={handleSave}
          disabled={!name.trim() || conditions.length === 0}
        >
          {isNew ? 'Add rule · Aggiungi' : 'Save · Salva'}
        </button>
      </div>

      {/* Delete */}
      {!isNew && onDelete && (
        <div style={{ marginTop: 12 }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button className="btn-destructive" style={{ flex: 1 }} onClick={onDelete}>
                Delete rule · Elimina
              </button>
            </div>
          ) : (
            <button
              className="btn-destructive"
              style={{ width: '100%' }}
              onClick={() => setConfirmDelete(true)}
            >
              Delete rule · Elimina regola
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ConditionRow ────────────────────────────────────────────────────────────

function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: RuleCondition
  onChange: (c: RuleCondition) => void
  onRemove: () => void
}) {
  const valueType = getFieldValueType(condition.field)
  const validOps = getOperatorsForField(condition.field)

  function handleFieldChange(field: RuleField) {
    const ops = getOperatorsForField(field)
    const vt = getFieldValueType(field)
    const defaultValue = vt === 'boolean' ? true : vt === 'number' ? 0 : ''
    onChange({ field, operator: ops[0], value: defaultValue })
  }

  return (
    <div className="condition-row">
      {/* Field */}
      <select
        className="input condition-field"
        value={condition.field}
        onChange={e => handleFieldChange(e.target.value as RuleField)}
      >
        {ALL_RULE_FIELDS.map(f => (
          <option key={f} value={f}>{RULE_FIELD_LABELS[f].en}</option>
        ))}
      </select>

      {/* Operator */}
      <select
        className="input condition-op"
        value={condition.operator}
        onChange={e => onChange({ ...condition, operator: e.target.value as RuleOperator })}
      >
        {validOps.map(op => (
          <option key={op} value={op}>{RULE_OPERATOR_LABELS[op]}</option>
        ))}
      </select>

      {/* Value */}
      {valueType === 'boolean' ? (
        <select
          className="input condition-value"
          value={String(condition.value)}
          onChange={e => onChange({ ...condition, value: e.target.value === 'true' })}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : valueType === 'number' ? (
        <input
          type="number"
          className="input condition-value"
          value={condition.value as number}
          onChange={e => onChange({ ...condition, value: parseFloat(e.target.value) || 0 })}
          step="1"
          min="0"
        />
      ) : condition.field === 'customs_category' ? (
        <select
          className="input condition-value"
          value={String(condition.value)}
          onChange={e => onChange({ ...condition, value: e.target.value })}
        >
          <option value="">— Select —</option>
          {Object.entries(CUSTOMS_CATEGORY_LABELS).map(([key, lbl]) => (
            <option key={key} value={key}>{lbl.en}</option>
          ))}
        </select>
      ) : condition.field === 'shipping_restriction' ? (
        <select
          className="input condition-value"
          value={String(condition.value)}
          onChange={e => onChange({ ...condition, value: e.target.value })}
        >
          <option value="none">None</option>
          <option value="restricted">Restricted</option>
          <option value="prohibited">Prohibited</option>
        </select>
      ) : condition.field === 'fragility' ? (
        <select
          className="input condition-value"
          value={String(condition.value)}
          onChange={e => onChange({ ...condition, value: e.target.value })}
        >
          <option value="none">None</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="irreplaceable">Irreplaceable</option>
        </select>
      ) : (
        <input
          type="text"
          className="input condition-value"
          value={String(condition.value)}
          onChange={e => onChange({ ...condition, value: e.target.value })}
        />
      )}

      {/* Remove */}
      <button
        className="condition-remove"
        onClick={onRemove}
        type="button"
        aria-label="Remove condition"
      >
        ×
      </button>
    </div>
  )
}

// ─── LocationsManager ─────────────────────────────────────────────────────────

function LocationsManager() {
  const { state, dispatch } = useApp()
  const { locations, boxes } = state

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editNameIt, setEditNameIt] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNameIt, setNewNameIt] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const sorted = [...locations].sort((a, b) => a.sort_order - b.sort_order)

  function boxCountAt(locationId: number) {
    return boxes.filter(b => b.current_location_id === locationId).length
  }

  async function handleReorder(loc: Location, direction: 'up' | 'down') {
    const idx = sorted.findIndex(l => l.id === loc.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    setSaving(true)
    await Promise.all([
      supabase.from('cernita_locations').update({ sort_order: other.sort_order }).eq('id', loc.id),
      supabase.from('cernita_locations').update({ sort_order: loc.sort_order }).eq('id', other.id),
    ])
    setSaving(false)
    dispatch({ type: 'UPSERT_LOCATION', location: { ...loc, sort_order: other.sort_order } })
    dispatch({ type: 'UPSERT_LOCATION', location: { ...other, sort_order: loc.sort_order } })
  }

  function startEdit(loc: Location) {
    setEditingId(loc.id)
    setEditName(loc.name)
    setEditNameIt(loc.name_it ?? '')
    setConfirmDeleteId(null)
    setError('')
  }

  async function handleSaveEdit(id: number) {
    if (!editName.trim()) { setError('Name is required'); return }
    setSaving(true)
    const { data, error: err } = await supabase
      .from('cernita_locations')
      .update({ name: editName.trim(), name_it: editNameIt.trim() || null })
      .eq('id', id)
      .select()
      .single()
    setSaving(false)
    if (err || !data) { setError('Save failed — try again'); return }
    dispatch({ type: 'UPSERT_LOCATION', location: data as Location })
    setEditingId(null)
  }

  async function handleDelete(loc: Location) {
    const count = boxCountAt(loc.id)
    if (count > 0) { setError(`Move ${count} box${count !== 1 ? 'es' : ''} out of "${loc.name}" first`); return }
    setSaving(true)
    const { error: err } = await supabase.from('cernita_locations').delete().eq('id', loc.id)
    setSaving(false)
    if (err) { setError('Delete failed — try again'); return }
    dispatch({ type: 'DELETE_LOCATION', id: loc.id })
    setEditingId(null)
    setConfirmDeleteId(null)
  }

  async function handleAdd() {
    if (!newName.trim()) return
    const maxOrder = sorted.length > 0 ? Math.max(...sorted.map(l => l.sort_order)) : 0
    setSaving(true)
    const { data, error: err } = await supabase
      .from('cernita_locations')
      .insert({ name: newName.trim(), name_it: newNameIt.trim() || null, sort_order: maxOrder + 10 })
      .select()
      .single()
    setSaving(false)
    if (err || !data) { setError('Add failed — try again'); return }
    dispatch({ type: 'UPSERT_LOCATION', location: data as Location })
    setNewName('')
    setNewNameIt('')
    setShowAdd(false)
    setError('')
  }

  const { syncStatus } = state

  if (syncStatus === 'syncing') {
    return <p className="settings-hint">Loading locations…</p>
  }

  if (locations.length === 0) {
    return (
      <div>
        <p className="settings-hint" style={{ marginBottom: 12 }}>
          No locations found. If you haven't run the database migration yet, open{' '}
          <strong>Supabase → SQL Editor</strong> and run{' '}
          <code style={{ fontSize: 12, background: 'var(--paper-dark)', padding: '1px 4px', borderRadius: 3 }}>
            docs/migration-006-boxes-locations.sql
          </code>
          , then reload the page.
        </p>
        <button className="btn-secondary" style={{ width: '100%' }} onClick={() => window.location.reload()}>
          Reload · Ricarica
        </button>
      </div>
    )
  }

  return (
    <div>
      {error && <p className="eval-error-text" style={{ marginBottom: 10 }}>{error}</p>}

      {sorted.map((loc, idx) => {
        const count = boxCountAt(loc.id)
        const isEditing = editingId === loc.id

        return (
          <div key={loc.id} className="loc-row">
            {isEditing ? (
              <div className="loc-edit-form">
                <label className="input-label">Name in English</label>
                <input
                  className="input"
                  style={{ marginBottom: 8 }}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="e.g. Colorado Springs storage"
                />
                <label className="input-label">Nome in italiano (opzionale)</label>
                <input
                  className="input"
                  style={{ marginBottom: 14 }}
                  value={editNameIt}
                  onChange={e => setEditNameIt(e.target.value)}
                  placeholder="e.g. Deposito a Colorado Springs"
                />
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => { setEditingId(null); setError('') }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    style={{ flex: 2 }}
                    onClick={() => handleSaveEdit(loc.id)}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save · Salva'}
                  </button>
                </div>

                {confirmDeleteId === loc.id ? (
                  <div className="delete-confirm">
                    <p className="delete-confirm-text">Delete <strong>{loc.name}</strong>?</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                      <button
                        className="btn-destructive"
                        style={{ flex: 1 }}
                        onClick={() => handleDelete(loc)}
                        disabled={saving || count > 0}
                      >
                        {saving ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn-destructive"
                    style={{ width: '100%' }}
                    onClick={() => {
                      if (count > 0) setError(`Move ${count} box${count !== 1 ? 'es' : ''} out of "${loc.name}" before deleting`)
                      else setConfirmDeleteId(loc.id)
                    }}
                  >
                    Delete · Elimina{count > 0 ? ` (${count} box${count !== 1 ? 'es' : ''} here)` : ''}
                  </button>
                )}
              </div>
            ) : (
              <div className="loc-row-content">
                <div className="loc-order-btns">
                  <button
                    className="loc-order-btn"
                    onClick={() => handleReorder(loc, 'up')}
                    disabled={idx === 0 || saving}
                    aria-label="Move up"
                  >↑</button>
                  <button
                    className="loc-order-btn"
                    onClick={() => handleReorder(loc, 'down')}
                    disabled={idx === sorted.length - 1 || saving}
                    aria-label="Move down"
                  >↓</button>
                </div>
                <div className="loc-names">
                  <span className="loc-name">{loc.name}</span>
                  {loc.name_it && loc.name_it !== loc.name && (
                    <span className="loc-name-it"> · {loc.name_it}</span>
                  )}
                  {count > 0 && (
                    <span className="loc-box-count">{count} box{count !== 1 ? 'es' : ''}</span>
                  )}
                </div>
                <button className="loc-edit-btn" onClick={() => startEdit(loc)} aria-label="Edit location">
                  ✎
                </button>
              </div>
            )}
          </div>
        )
      })}

      {showAdd ? (
        <div className="loc-add-form">
          <label className="input-label">Name in English</label>
          <input
            className="input"
            style={{ marginBottom: 10 }}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Dad's garage"
            autoFocus
          />
          <label className="input-label">Nome in italiano (opzionale)</label>
          <input
            className="input"
            style={{ marginBottom: 14 }}
            value={newNameIt}
            onChange={e => setNewNameIt(e.target.value)}
            placeholder="e.g. Garage di papà"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => { setShowAdd(false); setNewName(''); setNewNameIt(''); setError('') }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              style={{ flex: 2 }}
              onClick={handleAdd}
              disabled={saving || !newName.trim()}
            >
              {saving ? 'Adding…' : 'Add · Aggiungi'}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-secondary"
          style={{ width: '100%', marginTop: 10 }}
          onClick={() => { setShowAdd(true); setError('') }}
        >
          + Add location · Aggiungi posizione
        </button>
      )}
    </div>
  )
}

// ─── CustomsProfileEditor ────────────────────────────────────────────────────

const PORT_OPTIONS = ['Genova', 'Livorno', 'Napoli', 'Roma Fiumicino', 'Trieste', 'Venezia', 'Other']

function CustomsProfileEditor({
  profile,
  italyAddressFallback,
  onChange,
}: {
  profile: CustomsDeclarantProfile
  italyAddressFallback: string
  onChange: (p: CustomsDeclarantProfile) => void
}) {
  function update<K extends keyof CustomsDeclarantProfile>(key: K, value: CustomsDeclarantProfile[K]) {
    onChange({ ...profile, [key]: value })
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Joint toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Joint declaration</p>
            <p className="settings-hint">Both names on the customs filing</p>
          </div>
          <label className="toggle-switch" style={{ flexShrink: 0, marginLeft: 16 }}>
            <input
              type="checkbox"
              checked={profile.bothDeclarants}
              onChange={e => update('bothDeclarants', e.target.checked)}
            />
            <span className="toggle-track"><span className="toggle-thumb" /></span>
          </label>
        </div>

        {/* Primary declarant */}
        <div>
          <label className="input-label">Full legal name · Nome completo</label>
          <input
            type="text"
            className="input"
            value={profile.namePrimary}
            onChange={e => update('namePrimary', e.target.value)}
            placeholder="e.g. John A. Smith"
          />
        </div>
        <div>
          <label className="input-label">Date of birth · Data di nascita</label>
          <input
            type="date"
            className="input"
            value={profile.dobPrimary}
            onChange={e => update('dobPrimary', e.target.value)}
          />
        </div>
        <div>
          <label className="input-label">Nationality · Cittadinanza</label>
          <input
            type="text"
            className="input"
            value={profile.nationalityPrimary}
            onChange={e => update('nationalityPrimary', e.target.value)}
            placeholder="American"
          />
        </div>

        {/* Secondary declarant */}
        {profile.bothDeclarants && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid var(--paper-dark)', margin: '4px 0' }} />
            <p className="input-label" style={{ fontWeight: 600 }}>Second declarant · Secondo dichiarante</p>
            <div>
              <label className="input-label">Full legal name</label>
              <input
                type="text"
                className="input"
                value={profile.nameSecondary}
                onChange={e => update('nameSecondary', e.target.value)}
                placeholder="e.g. Jane B. Smith"
              />
            </div>
            <div>
              <label className="input-label">Date of birth</label>
              <input
                type="date"
                className="input"
                value={profile.dobSecondary}
                onChange={e => update('dobSecondary', e.target.value)}
              />
            </div>
          </>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--paper-dark)', margin: '4px 0' }} />

        {/* Addresses */}
        <div>
          <label className="input-label">US address (prior residence) · Indirizzo USA</label>
          <textarea
            className="input"
            rows={3}
            style={{ resize: 'vertical' }}
            value={profile.usAddress}
            onChange={e => update('usAddress', e.target.value)}
            placeholder="123 Main St, Galesburg, IL 61401"
          />
        </div>
        <div>
          <label className="input-label">Italian address (destination) · Indirizzo Italia</label>
          <textarea
            className="input"
            rows={3}
            style={{ resize: 'vertical' }}
            value={profile.italyAddress || italyAddressFallback}
            onChange={e => update('italyAddress', e.target.value)}
            placeholder="Via Roma 42, 05059 Todi (PG), Umbria"
          />
          {!profile.italyAddress && italyAddressFallback && (
            <p className="settings-hint" style={{ marginTop: 4 }}>
              Using address from box labels settings
            </p>
          )}
        </div>

        {/* Logistics */}
        <div>
          <label className="input-label">Port of entry · Porto di ingresso</label>
          <select
            className="input"
            value={profile.portOfEntry}
            onChange={e => update('portOfEntry', e.target.value)}
          >
            <option value="">— Select —</option>
            {PORT_OPTIONS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="input-label">Estimated arrival date · Data di arrivo prevista</label>
          <input
            type="date"
            className="input"
            value={profile.arrivalDateEstimate}
            onChange={e => update('arrivalDateEstimate', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── DataDeletion (Constitution P3) ──────────────────────────────────────────

function DataDeletion() {
  const { state, dispatch } = useApp()
  const router = useRouter()
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting' | 'done'>('idle')
  const [error, setError] = useState('')

  const totalEntries = state.log.length
  const totalBoxes = state.boxes.length
  const totalTrips = state.trips.length
  const totalLocations = state.locations.length
  const totalItems = totalEntries + totalBoxes + totalTrips + totalLocations

  async function handleDeleteAll() {
    setStep('deleting')
    setError('')

    try {
      // Delete in dependency order: entries (have box_id FK) → boxes → trips → locations
      // Each delete uses a broad filter to catch all rows
      const { error: e1 } = await supabase.from('cernita_entries').delete().neq('id', 0)
      if (e1) throw new Error(`Entries: ${e1.message}`)

      const { error: e2 } = await supabase.from('cernita_boxes').delete().neq('id', 0)
      if (e2) throw new Error(`Boxes: ${e2.message}`)

      const { error: e3 } = await supabase.from('cernita_trips').delete().neq('id', 0)
      if (e3) throw new Error(`Trips: ${e3.message}`)

      const { error: e4 } = await supabase.from('cernita_locations').delete().neq('id', 0)
      if (e4) throw new Error(`Locations: ${e4.message}`)

      // Clear local state
      dispatch({ type: 'SET_LOG', entries: [] })
      dispatch({ type: 'SET_BOXES', boxes: [] })
      dispatch({ type: 'SET_TRIPS', trips: [] })
      dispatch({ type: 'SET_LOCATIONS', locations: [] })

      // Clear localStorage
      localStorage.removeItem('cernita_settings')

      setStep('done')

      // Sign out after a moment
      setTimeout(async () => {
        await supabase.auth.signOut()
        router.replace('/login')
      }, 3000)
    } catch (err) {
      console.error('Data deletion failed:', err)
      setError(err instanceof Error ? err.message : 'Deletion failed — try again')
      setStep('confirm')
    }
  }

  if (step === 'done') {
    return (
      <div className="card" style={{ marginBottom: 24, background: '#fdf0f0', border: '1px solid #f5c6c6' }}>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>All data deleted</p>
        <p className="ink-soft" style={{ fontSize: 13 }}>
          Signing out… · Disconnessione in corso…
        </p>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 24, background: '#fdf0f0', border: '1px solid #f5c6c6' }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>Delete all data · Elimina tutti i dati</p>
      <p className="ink-soft" style={{ fontSize: 13, marginBottom: 12 }}>
        Permanently delete all {totalItems} items ({totalEntries} entries, {totalBoxes} boxes,
        {' '}{totalTrips} trips, {totalLocations} locations), clear settings, and sign out.
        This cannot be undone.
      </p>
      <p className="italic ink-soft" style={{ fontSize: 12, marginBottom: 14 }}>
        Elimina permanentemente tutti i dati e disconnettiti. Non è possibile annullare.
      </p>

      {error && <p className="eval-error-text" style={{ marginBottom: 10 }}>{error}</p>}

      {step === 'confirm' ? (
        <div>
          <p style={{ fontWeight: 700, color: '#8b1a1a', fontSize: 14, marginBottom: 12 }}>
            Are you sure? This will delete everything. · Sei sicuro? Tutto verrà eliminato.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setStep('idle')}
            >
              Cancel
            </button>
            <button
              className="btn-destructive"
              style={{ flex: 2 }}
              onClick={handleDeleteAll}
            >
              Yes, delete everything · Sì, elimina tutto
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn-destructive"
          style={{ width: '100%' }}
          onClick={() => setStep('confirm')}
          disabled={step === 'deleting'}
        >
          {step === 'deleting' ? 'Deleting… · Eliminazione…' : 'Delete all my data · Elimina tutti i dati'}
        </button>
      )}
    </div>
  )
}
