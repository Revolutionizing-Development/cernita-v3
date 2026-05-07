import { Entry, CernitaSettings } from './types'

/**
 * Re-compute derived cost fields from observed facts + current rates.
 * Pure local math — no AI call required.
 *
 * Cost model (spec 016 — phased move):
 *   Leg 1: Ground move from Galesburg IL → Colorado (weight × movingRatePerLb)
 *   Leg 2: Ocean ship from Colorado → Italy (weight × shippingRatePerLb + volume × shippingRatePerCuFt)
 *   Total to Italy = Leg 1 + Leg 2
 *
 * Field mapping (reuses existing columns to avoid migration):
 *   storage_cost_total → Move to Colorado cost (Leg 1)
 *   ship_cost          → Ocean ship cost (Leg 2)
 *   net_cost_ship      → Total cost to Italy (Leg 1 + Leg 2)
 *   net_cost_storage   → Savings vs replacement (replacement_cost − total_to_italy)
 *                         Positive = shipping saves money; negative = replacing is cheaper
 */
export function recomputeCosts(entry: Entry, settings: CernitaSettings) {
  const weight = entry.weight_lb ?? 0
  const volume = entry.volume_cuft ?? 0
  const replacement = entry.replacement_cost ?? 0

  // Leg 1: Ground move IL → Colorado
  const move_cost_co = weight * settings.movingRatePerLb

  // Leg 2: Ocean ship Colorado → Italy
  const ship_cost = weight * settings.shippingRatePerLb + volume * settings.shippingRatePerCuFt

  // Total pipeline cost to get item to Italy
  const total_to_italy = move_cost_co + ship_cost

  // Savings: how much do you save by shipping vs. buying new in Italy?
  // Positive = shipping is cheaper; negative = replacing is cheaper
  const savings = replacement > 0 ? replacement - total_to_italy : null

  return {
    storage_cost_total: move_cost_co || null,     // Leg 1: move to CO
    ship_cost: ship_cost || null,                  // Leg 2: ocean ship
    net_cost_ship: total_to_italy || null,         // Total to Italy
    net_cost_storage: savings,                      // Savings vs replacement
  }
}

/**
 * Check whether an entry was evaluated under older rules.
 */
export function isOutdated(entry: Entry, settings: CernitaSettings): boolean {
  return !!entry.rules_version && entry.rules_version !== settings.rulesVersion
}
