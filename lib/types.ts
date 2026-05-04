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
  | 'KEEP-TEXAS'
  | 'SELL'
  | 'DONATE'
  | 'DISPOSE'
  | 'GIVE-FAMILY'
  | 'NEEDS-HUMAN'

export const DECISION_LABELS: Record<Decision, { en: string; it: string }> = {
  'KEEP-ITALY':  { en: 'Keep — ship to Italy', it: 'Porta in Italia' },
  'KEEP-TEXAS':  { en: 'Keep — move to Texas', it: 'Porta in Texas' },
  'SELL':        { en: 'Sell', it: 'Vendi' },
  'DONATE':      { en: 'Donate', it: 'Dona' },
  'DISPOSE':     { en: 'Dispose', it: 'Smaltisci' },
  'GIVE-FAMILY': { en: 'Give to family', it: 'Dai alla famiglia' },
  'NEEDS-HUMAN': { en: 'Needs discussion', it: 'Richiede discussione' },
}

export const DECISION_BADGE_CLASS: Record<Decision, string> = {
  'KEEP-ITALY':  'badge badge-keep-italy',
  'KEEP-TEXAS':  'badge badge-keep-texas',
  'SELL':        'badge badge-sell',
  'DONATE':      'badge badge-donate',
  'DISPOSE':     'badge badge-dispose',
  'GIVE-FAMILY': 'badge badge-give-family',
  'NEEDS-HUMAN': 'badge badge-needs-human',
}

export interface CernitaSettings {
  storageRatePerCuFt: number
  shippingRatePerLb: number
  shippingRatePerCuFt: number
  monthsInStorage: number
  weightSoftThresholdLb: number
  weightHardThresholdLb: number
  aiModel: string
  rulesVersion: string
}

export const DEFAULT_SETTINGS: CernitaSettings = {
  storageRatePerCuFt: 2.50,
  shippingRatePerLb: 0.75,
  shippingRatePerCuFt: 4.00,
  monthsInStorage: 18,
  weightSoftThresholdLb: 50,
  weightHardThresholdLb: 70,
  aiModel: 'claude-sonnet-4-5',
  rulesVersion: '1.0.0',
}
