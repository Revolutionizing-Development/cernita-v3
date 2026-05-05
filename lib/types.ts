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
  photo_data: string | null
  bin_id: string | null
  box_id: number | null
  current_location_id: number | null
}

export type Decision =
  | 'KEEP-ITALY'
  | 'KEEP-US'       // intermediate US stop — city configured in Settings
  | 'SELL'
  | 'DONATE'
  | 'DISPOSE'
  | 'GIVE-FAMILY'
  | 'NEEDS-HUMAN'

// Static fallback labels — KEEP-US display label is overridden dynamically
// by getDecisionLabel() which uses the configured usDestination.
export const DECISION_LABELS: Record<Decision, { en: string; it: string }> = {
  'KEEP-ITALY':  { en: 'Keep — ship to Italy',    it: 'Porta in Italia' },
  'KEEP-US':     { en: 'Keep — US stop',           it: 'Porta negli USA' },
  'SELL':        { en: 'Sell',                     it: 'Vendi' },
  'DONATE':      { en: 'Donate',                   it: 'Dona' },
  'DISPOSE':     { en: 'Dispose',                  it: 'Smaltisci' },
  'GIVE-FAMILY': { en: 'Give to family',           it: 'Dai alla famiglia' },
  'NEEDS-HUMAN': { en: 'Needs discussion',         it: 'Richiede discussione' },
}

// Returns a decision label, substituting the configured US city for KEEP-US.
export function getDecisionLabel(
  decision: Decision,
  usDestination = 'Colorado Springs'
): { en: string; it: string } {
  if (decision === 'KEEP-US') {
    return {
      en: `Keep — move to ${usDestination}`,
      it: `Porta a ${usDestination}`,
    }
  }
  return DECISION_LABELS[decision]
}

export const DECISION_BADGE_CLASS: Record<Decision, string> = {
  'KEEP-ITALY':  'badge badge-keep-italy',
  'KEEP-US':     'badge badge-keep-us',
  'SELL':        'badge badge-sell',
  'DONATE':      'badge badge-donate',
  'DISPOSE':     'badge badge-dispose',
  'GIVE-FAMILY': 'badge badge-give-family',
  'NEEDS-HUMAN': 'badge badge-needs-human',
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
  // Suitcase fields (spec 007) — null for cardboard boxes
  box_type: 'cardboard' | 'suitcase' | null
  trip_id: number | null
  suitcase_class: 'checked' | 'carry_on' | 'personal_item' | null
  weight_limit_lb: number | null
}

export type TripStatus = 'planned' | 'packing' | 'executed' | 'canceled'

export const TRIP_STATUS_LABELS: Record<TripStatus, { en: string; it: string }> = {
  planned:  { en: 'Planned',   it: 'Pianificato' },
  packing:  { en: 'Packing',   it: 'In preparazione' },
  executed: { en: 'Executed',  it: 'Completato' },
  canceled: { en: 'Canceled',  it: 'Annullato' },
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

export interface CernitaSettings {
  // Move route
  usDestination: string        // the intermediate US city (e.g. "Colorado Springs")
  // Storage
  storageRatePerCuFt: number
  monthsInStorage: number
  // Ocean shipping
  shippingRatePerLb: number
  shippingRatePerCuFt: number
  // Weight thresholds (cardboard boxes)
  weightSoftThresholdLb: number
  weightHardThresholdLb: number
  // Trip / suitcase weight defaults (spec 007)
  checkedBagLimitLb: number
  carryOnLimitLb: number
  personalItemLimitLb: number
  // AI
  aiModel: string
  // Rule versioning (bumped when rates change)
  rulesVersion: string
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
  rulesVersion: '1.0.0',
}
