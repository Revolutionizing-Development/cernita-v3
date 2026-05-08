export interface Entry {
  id: number
  created_at: string
  updated_at: string
  user_name: string
  item_name: string
  item_name_it: string | null
  final_decision: Decision
  user_confirmed: boolean
  override_reason: string | null
  estimated_resale_value: number | null
  replacement_cost: number | null
  weight_lb: number | null
  volume_cuft: number | null
  storage_cost_total: number | null
  ship_cost: number | null
  carry_bag_cost: number | null
  net_cost_ship: number | null
  net_cost_storage: number | null
  recommendation_rationale: string | null
  recommendation_rationale_it: string | null
  confidence: 'high' | 'medium' | 'low' | null
  rules_version: string | null
  rules_snapshot: Record<string, unknown> | null
  fragility: 'none' | 'low' | 'medium' | 'high' | 'irreplaceable' | null
  survival_risk: string | null
  survival_risk_it: string | null
  packing_notes: string | null
  packing_notes_it: string | null
  item_model: string | null
  oversized: boolean | null
  voltage_incompatible: boolean | null
  photo_data: string | null
  bin_id: string | null
  box_id: number | null
  current_location_id: number | null
  shipping_restriction: 'none' | 'restricted' | 'prohibited' | null
  shipping_restriction_note: string | null
  shipping_restriction_note_it: string | null
  // Phase (spec 016) — when does the action happen?
  action_phase: ActionPhase | null
  // Override tags (spec 016) — structured reasons for overrides
  override_tags: string[] | null
  // Italy confirmation gate (spec 016) — active-use items must be re-confirmed
  italy_confirmed: boolean
  // Customs fields (spec 015)
  acquisition_year: number | null
  customs_eligible: boolean | null
  customs_category: CustomsCategory | null
  customs_notes: string | null
  customs_exclude: boolean | null
}

export type Decision =
  | 'SHIP-ITALY'
  | 'SELL'
  | 'DONATE'
  | 'DISPOSE'
  | 'GIVE-FAMILY'
  | 'CONSUME'
  | 'NEEDS-HUMAN'

// Action phase — when does the decision happen?
export type ActionPhase = 'NOW' | 'COLORADO'

export const ACTION_PHASE_LABELS: Record<ActionPhase, { en: string; it: string }> = {
  'NOW':      { en: 'Now',       it: 'Ora' },
  'COLORADO': { en: 'Colorado',  it: 'Colorado' },
}

export const DECISION_LABELS: Record<Decision, { en: string; it: string }> = {
  'SHIP-ITALY':  { en: 'Ship to Italy',     it: 'Spedire in Italia' },
  'SELL':        { en: 'Sell',               it: 'Vendi' },
  'DONATE':      { en: 'Donate',             it: 'Dona' },
  'DISPOSE':     { en: 'Dispose',            it: 'Smaltisci' },
  'GIVE-FAMILY': { en: 'Give to family',     it: 'Dai alla famiglia' },
  'CONSUME':     { en: 'Use up',             it: 'Consuma' },
  'NEEDS-HUMAN': { en: 'Needs discussion',   it: 'Richiede discussione' },
}

// Returns a decision label, optionally combined with action phase.
// Handles legacy decision values (KEEP-ITALY, KEEP-US) gracefully for entries
// that haven't been migrated yet in the database.
export function getDecisionLabel(
  decision: Decision,
  _usDestination = 'Colorado',
  phase?: ActionPhase | null
): { en: string; it: string } {
  const base = DECISION_LABELS[decision]
    ?? LEGACY_DECISION_LABELS[decision as string]
    ?? { en: decision, it: decision }
  if (!phase) return base

  // Combine decision + phase for SELL, DONATE, CONSUME
  if (phase === 'NOW') {
    if (decision === 'SELL') return { en: 'Sell now', it: 'Vendi ora' }
    if (decision === 'DONATE') return { en: 'Donate now', it: 'Dona ora' }
  }
  if (phase === 'COLORADO') {
    if (decision === 'SELL') return { en: 'Sell in Colorado', it: 'Vendi in Colorado' }
    if (decision === 'DONATE') return { en: 'Donate in Colorado', it: 'Dona in Colorado' }
    if (decision === 'CONSUME') return { en: 'Use up in Colorado', it: 'Consuma in Colorado' }
  }
  return base
}

// Legacy decision labels — for entries in the DB that haven't been migrated yet.
// These map old decision values to display-friendly labels until the migration runs.
const LEGACY_DECISION_LABELS: Record<string, { en: string; it: string }> = {
  'KEEP-ITALY':  { en: 'Ship to Italy',        it: 'Spedire in Italia' },
  'KEEP-US':     { en: 'Keep in US',            it: 'Tenere negli USA' },
  'KEEP-TEXAS':  { en: 'Keep in US',            it: 'Tenere negli USA' },
}

// Map legacy decision values to their modern equivalents for badge styling
export const LEGACY_DECISION_BADGE: Record<string, string> = {
  'KEEP-ITALY': 'badge badge-ship-italy',
  'KEEP-US':    'badge badge-sell',
  'KEEP-TEXAS': 'badge badge-sell',
}

export const DECISION_BADGE_CLASS: Record<Decision, string> = {
  'SHIP-ITALY':  'badge badge-ship-italy',
  'SELL':        'badge badge-sell',
  'DONATE':      'badge badge-donate',
  'DISPOSE':     'badge badge-dispose',
  'GIVE-FAMILY': 'badge badge-give-family',
  'CONSUME':     'badge badge-consume',
  'NEEDS-HUMAN': 'badge badge-needs-human',
}

// Override tags (spec 016) — structured reasons for overrides
export const OVERRIDE_TAGS = [
  { id: 'voltage',            en: 'Voltage',            it: 'Voltaggio' },
  { id: 'too-heavy',          en: 'Too heavy',          it: 'Troppo pesante' },
  { id: 'sentimental',        en: 'Sentimental',        it: 'Sentimentale' },
  { id: 'cheap-to-replace',   en: 'Cheap to replace',   it: 'Economico da sostituire' },
  { id: 'expensive-to-ship',  en: 'Expensive to ship',  it: 'Costoso da spedire' },
  { id: 'fragile',            en: 'Fragile',             it: 'Fragile' },
  { id: 'daily-use',          en: 'Daily use',           it: 'Uso quotidiano' },
  { id: 'consumable',         en: 'Consumable',          it: 'Consumabile' },
  { id: 'other',              en: 'Other',               it: 'Altro' },
] as const

export type OverrideTagId = typeof OVERRIDE_TAGS[number]['id']

// Colorado box placement (spec 016)
export type ColoradoPlacement = 'ACTIVE-USE' | 'HOUSE-STORAGE' | 'GARAGE'

export const COLORADO_PLACEMENT_LABELS: Record<ColoradoPlacement, { en: string; it: string; icon: string; climate: string }> = {
  'ACTIVE-USE':    { en: 'Active use',       it: 'Uso attivo',       icon: '\uD83C\uDFE0', climate: 'Climate-controlled' },
  'HOUSE-STORAGE': { en: 'House storage',    it: 'Deposito in casa', icon: '\uD83D\uDDC4\uFE0F', climate: 'Climate-controlled' },
  'GARAGE':        { en: 'Garage',           it: 'Garage',           icon: '\uD83D\uDE97', climate: 'Non-climate-controlled' },
}

export interface Location {
  id: number
  name: string
  name_it: string | null
  is_default: boolean
  sort_order: number
  created_at: string
}

export interface Box {
  id: number
  box_number: string
  destination: Decision
  current_location_id: number | null
  notes: string | null
  notes_it: string | null
  closed_at: string | null
  created_at: string
  // Suitcase fields (spec 007) — null for plastic boxes
  box_type: 'plastic' | 'suitcase' | null
  trip_id: number | null
  suitcase_class: 'checked' | 'carry_on' | 'personal_item' | null
  weight_limit_lb: number | null
  // Storage requirement (migration 008)
  storage_requirement: 'climate_controlled' | 'standard' | 'garage_ok' | null
  // Colorado placement (spec 016)
  colorado_placement: ColoradoPlacement | null
}

export type TripStatus = 'planned' | 'packing' | 'executed' | 'canceled'

export const TRIP_STATUS_LABELS: Record<TripStatus, { en: string; it: string }> = {
  planned:  { en: 'Planned',   it: 'Pianificato' },
  packing:  { en: 'Packing',   it: 'In preparazione' },
  executed: { en: 'Executed',  it: 'Completato' },
  canceled: { en: 'Canceled',  it: 'Annullato' },
}

export const STORAGE_REQUIREMENT_LABELS: Record<'climate_controlled' | 'standard' | 'garage_ok', { en: string; it: string; hint: string }> = {
  climate_controlled: { en: 'Climate controlled', it: 'Climatizzato',    hint: 'Books, art, electronics, leather, instruments' },
  standard:           { en: 'Standard indoor',    it: 'Interno standard', hint: 'Most household items' },
  garage_ok:          { en: 'Garage / outdoor ok', it: 'Va bene in garage', hint: 'Tools, pots & pans, outdoor gear, metal items' },
}

export const SUITCASE_CLASS_LABELS: Record<'checked' | 'carry_on' | 'personal_item', { en: string; it: string }> = {
  checked:       { en: 'Checked bag',    it: 'Da stiva' },
  carry_on:      { en: 'Carry-on',       it: 'A mano' },
  personal_item: { en: 'Personal item',  it: 'Oggetto personale' },
}

export interface Trip {
  id: number
  name: string
  name_it: string | null
  traveler_name: string
  origin_location_id: number | null
  destination_location_id: number | null
  departure_date: string | null
  return_date: string | null
  status: TripStatus
  executed_at: string | null
  notes: string | null
  notes_it: string | null
  created_at: string
}

// ─── Chat messages (spec 018) ─────────────────────────────────────────────

export interface ChatMessage {
  id: number
  entry_id: number
  role: 'user' | 'assistant'
  content: string
  metadata: ChatMessageMetadata
  created_at: string
  created_by: string | null
}

export interface ChatMessageMetadata {
  updated_recommendation?: {
    decision: Decision
    action_phase?: ActionPhase | null
    rationale?: string
    rationale_it?: string
  }
}

// ─── Customs types (spec 015) ─────────────────────────────────────────────

export type CustomsCategory =
  | 'mobili'               // Mobili e arredamento
  | 'abbigliamento'        // Abbigliamento
  | 'libri'                // Libri e documenti
  | 'elettronica'          // Apparecchiature elettroniche
  | 'strumenti_musicali'   // Strumenti musicali
  | 'arte'                 // Arte e oggetti di valore affettivo
  | 'cucina'               // Cucina e utensili
  | 'sport'                // Sport e tempo libero
  | 'altri'                // Altri beni personali

export const CUSTOMS_CATEGORY_LABELS: Record<CustomsCategory, { it: string; en: string }> = {
  mobili:             { it: 'Mobili e arredamento',                     en: 'Furniture & furnishings' },
  abbigliamento:      { it: 'Abbigliamento',                           en: 'Clothing' },
  libri:              { it: 'Libri e documenti',                       en: 'Books & documents' },
  elettronica:        { it: 'Apparecchiature elettroniche',            en: 'Electronics' },
  strumenti_musicali: { it: 'Strumenti musicali',                     en: 'Musical instruments' },
  arte:               { it: 'Arte e oggetti di valore affettivo',      en: 'Art & sentimental items' },
  cucina:             { it: 'Cucina e utensili',                       en: 'Kitchen & utensils' },
  sport:              { it: 'Sport e tempo libero',                    en: 'Sports & leisure' },
  altri:              { it: 'Altri beni personali',                    en: 'Other personal goods' },
}

export interface CustomsDeclarantProfile {
  namePrimary: string
  dobPrimary: string         // ISO date string
  nationalityPrimary: string
  nameSecondary: string
  dobSecondary: string
  bothDeclarants: boolean
  usAddress: string
  italyAddress: string       // reuses settings.italyAddress if set
  portOfEntry: string        // e.g. "Genova", "Livorno", "Roma Fiumicino"
  arrivalDateEstimate: string
}

export const DEFAULT_CUSTOMS_PROFILE: CustomsDeclarantProfile = {
  namePrimary: '',
  dobPrimary: '',
  nationalityPrimary: 'American',
  nameSecondary: '',
  dobSecondary: '',
  bothDeclarants: true,
  usAddress: '',
  italyAddress: '',
  portOfEntry: '',
  arrivalDateEstimate: '',
}

// ─── Decision rules (spec 016 Part 4) ────────────────────────────────────

export type RuleField =
  | 'customs_category'       // CustomsCategory string
  | 'replacement_cost'       // number
  | 'ship_cost'              // number (ocean leg only)
  | 'net_cost_ship'          // number (total to Italy)
  | 'weight_lb'              // number
  | 'voltage_incompatible'   // boolean
  | 'shipping_restriction'   // 'none' | 'restricted' | 'prohibited'
  | 'fragility'              // 'none' | 'low' | 'medium' | 'high' | 'irreplaceable'
  | 'oversized'              // boolean

export const RULE_FIELD_LABELS: Record<RuleField, { en: string; it: string }> = {
  customs_category:     { en: 'Category',              it: 'Categoria' },
  replacement_cost:     { en: 'Replacement cost',      it: 'Costo di sostituzione' },
  ship_cost:            { en: 'Ocean ship cost',       it: 'Costo spedizione' },
  net_cost_ship:        { en: 'Total cost to Italy',   it: 'Costo totale per Italia' },
  weight_lb:            { en: 'Weight (lb)',            it: 'Peso (lb)' },
  voltage_incompatible: { en: 'Voltage incompatible',  it: 'Voltaggio incompatibile' },
  shipping_restriction: { en: 'Shipping restriction',  it: 'Restrizione spedizione' },
  fragility:            { en: 'Fragility',             it: 'Fragilità' },
  oversized:            { en: 'Oversized',             it: 'Fuori misura' },
}

export type RuleOperator = 'eq' | 'neq' | 'lt' | 'gt' | 'lte' | 'gte' | 'contains'

export const RULE_OPERATOR_LABELS: Record<RuleOperator, string> = {
  eq:       '=',
  neq:      '≠',
  lt:       '<',
  gt:       '>',
  lte:      '≤',
  gte:      '≥',
  contains: 'contains',
}

export interface RuleCondition {
  field: RuleField
  operator: RuleOperator
  value: string | number | boolean
}

export interface DecisionRule {
  id: string                              // UUID
  name: string                            // user-visible label
  conditions: RuleCondition[]             // ALL must match (AND logic)
  defaultDecision: Decision               // what to suggest
  defaultPhase: ActionPhase | null        // for SELL/DONATE/CONSUME
  priority: number                        // lower = higher priority
  enabled: boolean
  createdBy: 'user' | 'suggested'         // user-created vs system-suggested
  acceptedAt: string | null               // when a suggested rule was accepted
}

export interface RuleSuggestion {
  rule: DecisionRule                       // the proposed rule
  evidence: {
    matchCount: number                     // how many overrides match this pattern
    exampleItems: string[]                 // item names for display
    commonTags: OverrideTagId[]            // which override tags drove this
  }
}

// Operators valid for each field type
export function getOperatorsForField(field: RuleField): RuleOperator[] {
  switch (field) {
    case 'replacement_cost':
    case 'ship_cost':
    case 'net_cost_ship':
    case 'weight_lb':
      return ['eq', 'neq', 'lt', 'gt', 'lte', 'gte']
    case 'voltage_incompatible':
    case 'oversized':
      return ['eq']
    case 'customs_category':
    case 'shipping_restriction':
    case 'fragility':
      return ['eq', 'neq']
    default:
      return ['eq', 'neq']
  }
}

// Default value type hint per field
export function getFieldValueType(field: RuleField): 'number' | 'boolean' | 'select' {
  switch (field) {
    case 'replacement_cost':
    case 'ship_cost':
    case 'net_cost_ship':
    case 'weight_lb':
      return 'number'
    case 'voltage_incompatible':
    case 'oversized':
      return 'boolean'
    default:
      return 'select'
  }
}

export interface CernitaSettings {
  // Move route
  usDestination: string        // the intermediate US city (e.g. "Colorado Springs")
  // Ground move (IL → Colorado) — per-lb share of moving truck
  movingRatePerLb: number
  // Storage (legacy — kept for backward compat, not used in new cost model)
  storageRatePerCuFt: number
  monthsInStorage: number
  // Ocean shipping (Colorado → Italy)
  shippingRatePerLb: number
  shippingRatePerCuFt: number
  // Weight thresholds (plastic boxes)
  weightSoftThresholdLb: number
  weightHardThresholdLb: number
  // Trip / suitcase weight defaults (spec 007)
  checkedBagLimitLb: number
  carryOnLimitLb: number
  personalItemLimitLb: number
  // AI
  aiModel: string
  // EUR/USD exchange rate — used for Italian customs distinta
  eurRate: number
  // Italian destination address — printed on customs-compliant box labels
  italyAddress: string   // free-text: street, postcode, city, province, ITALIA
  // Animations (feature flag — set false to revert all motion)
  motionEnabled: boolean
  // Rule versioning (bumped when rates change)
  rulesVersion: string
  // Customs declarant profile (spec 015)
  customsProfile: CustomsDeclarantProfile
  // Perspective thresholds (spec 016) — dual-lens evaluation
  // Ship perspective: ship if replacement > ship_cost * this factor
  perspectiveShipThreshold: number
  // Ship perspective: sell if replacement < ship_cost * this factor
  perspectiveSellThreshold: number
  // Save perspective: ship if ship_cost < replacement * this factor
  perspectiveSaveShipThreshold: number
  // Save perspective: sell if ship_cost > replacement * this factor
  perspectiveSaveSellThreshold: number
  // Decision rules (spec 016 Part 4) — structured filters that suggest decisions
  decisionRules: DecisionRule[]
  // Colorado move cost estimation (spec 016 Part 7)
  coloradoMoveRatePerCuFt: number  // per-cu-ft rate for IL→CO ground move
  coloradoMoveFlatFee: number       // flat fee component (truck rental, etc.)
}

export const DEFAULT_SETTINGS: CernitaSettings = {
  usDestination: 'Colorado Springs',
  movingRatePerLb: 0.50,
  storageRatePerCuFt: 2.50,
  monthsInStorage: 18,
  shippingRatePerLb: 0.75,
  shippingRatePerCuFt: 4.00,
  weightSoftThresholdLb: 50,
  weightHardThresholdLb: 70,
  checkedBagLimitLb: 50,
  carryOnLimitLb: 22,
  personalItemLimitLb: 16,
  aiModel: 'claude-sonnet-4-5',
  eurRate: 0.92,
  italyAddress: '',
  motionEnabled: true,
  rulesVersion: '1.0.0',
  customsProfile: DEFAULT_CUSTOMS_PROFILE,
  perspectiveShipThreshold: 1.5,
  perspectiveSellThreshold: 0.5,
  perspectiveSaveShipThreshold: 0.3,
  perspectiveSaveSellThreshold: 0.7,
  decisionRules: [],
  coloradoMoveRatePerCuFt: 0,
  coloradoMoveFlatFee: 0,
}
