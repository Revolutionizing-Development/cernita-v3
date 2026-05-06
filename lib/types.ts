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
export function getDecisionLabel(
  decision: Decision,
  _usDestination = 'Colorado',
  phase?: ActionPhase | null
): { en: string; it: string } {
  const base = DECISION_LABELS[decision]
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

export const DECISION_BADGE_CLASS: Record<Decision, string> = {
  'SHIP-ITALY':  'badge badge-ship-italy',
  'SELL':        'badge badge-sell',
  'DONATE':      'badge badge-donate',
  'DISPOSE':     'badge badge-dispose',
  'GIVE-FAMILY': 'badge badge-give-family',
  'CONSUME':     'badge badge-consume',
  'NEEDS-HUMAN': 'badge badge-needs-human',
}

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

export interface CernitaSettings {
  // Move route
  usDestination: string        // the intermediate US city (e.g. "Colorado Springs")
  // Storage
  storageRatePerCuFt: number
  monthsInStorage: number
  // Ocean shipping
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
}

export const DEFAULT_SETTINGS: CernitaSettings = {
  usDestination: 'Colorado Springs',
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
}
