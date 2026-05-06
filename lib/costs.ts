import { Entry, CernitaSettings } from './types'

/**
 * Re-compute derived cost fields from observed facts + current rates.
 * Pure local math — no AI call required.
 */
export function recomputeCosts(entry: Entry, settings: CernitaSettings) {
  const weight = entry.weight_lb ?? 0
  const volume = entry.volume_cuft ?? 0
  const resale = entry.estimated_resale_value ?? 0
  const ship_cost = weight * settings.shippingRatePerLb + volume * settings.shippingRatePerCuFt
  const storage_cost_total = volume * settings.storageRatePerCuFt * settings.monthsInStorage
  return {
    ship_cost: ship_cost || null,
    storage_cost_total: storage_cost_total || null,
    net_cost_ship: ship_cost ? ship_cost - resale : null,
    net_cost_storage: storage_cost_total ? storage_cost_total - resale : null,
  }
}

/**
 * Check whether an entry was evaluated under older rules.
 */
export function isOutdated(entry: Entry, settings: CernitaSettings): boolean {
  return !!entry.rules_version && entry.rules_version !== settings.rulesVersion
}
