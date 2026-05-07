import { Decision, CernitaSettings } from './types'

// ─── Dual-perspective evaluation (spec 016, Part 5) ──────────────────────────
//
// Two lenses on every item:
//   Ship perspective (replacement-cost-focused): "What does it cost to buy again in Italy?"
//   Save perspective (shipping-cost-focused):    "What does it cost to ship this?"
//
// When perspectives disagree → auto-NEEDS-HUMAN so the couple can resolve together.
// When perspectives agree   → higher confidence.

export type PerspectiveDecision = 'SHIP-ITALY' | 'SELL' | 'neutral'

export interface Perspective {
  decision: PerspectiveDecision
  label: { en: string; it: string }
  reason: { en: string; it: string }
}

export interface DualPerspective {
  ship: Perspective      // replacement-cost-focused ("should we ship it?")
  save: Perspective      // shipping-cost-focused ("should we save on shipping?")
  agree: boolean         // both perspectives recommend the same action
  hasData: boolean       // enough data to compute perspectives
}

/**
 * Compute dual perspectives for an item.
 *
 * @param shipCost      Total cost to get this item to Italy (move to CO + ocean ship)
 * @param replaceCost   Estimated cost to replace this item in Italy
 * @param settings      Current settings (contains perspective thresholds)
 */
export function computePerspectives(
  shipCost: number | null | undefined,
  replaceCost: number | null | undefined,
  settings: CernitaSettings
): DualPerspective {
  // Need both values for comparison
  if (shipCost == null || replaceCost == null || shipCost === 0 || replaceCost === 0) {
    return {
      ship: {
        decision: 'neutral',
        label: { en: 'Ship perspective', it: 'Prospettiva spedizione' },
        reason: { en: 'Insufficient data', it: 'Dati insufficienti' },
      },
      save: {
        decision: 'neutral',
        label: { en: 'Save perspective', it: 'Prospettiva risparmio' },
        reason: { en: 'Insufficient data', it: 'Dati insufficienti' },
      },
      agree: true,
      hasData: false,
    }
  }

  const {
    perspectiveShipThreshold,
    perspectiveSellThreshold,
    perspectiveSaveShipThreshold,
    perspectiveSaveSellThreshold,
  } = settings

  // ─── Ship perspective (replacement-cost-focused) ───────────────────────
  // "Is it worth shipping to avoid buying again in Italy?"
  let shipDecision: PerspectiveDecision = 'neutral'
  let shipReason = { en: '', it: '' }

  if (replaceCost > shipCost * perspectiveShipThreshold) {
    shipDecision = 'SHIP-ITALY'
    const diff = Math.round(replaceCost - shipCost)
    shipReason = {
      en: `$${diff} cheaper to ship than replace in Italy`,
      it: `$${diff} in meno spedendo che ricomprando in Italia`,
    }
  } else if (replaceCost < shipCost * perspectiveSellThreshold) {
    shipDecision = 'SELL'
    const diff = Math.round(shipCost - replaceCost)
    shipReason = {
      en: `$${diff} cheaper to replace than ship`,
      it: `$${diff} in meno ricomprando che spedendo`,
    }
  } else {
    shipReason = {
      en: `Replace ($${Math.round(replaceCost)}) and ship ($${Math.round(shipCost)}) costs are similar`,
      it: `Sostituzione ($${Math.round(replaceCost)}) e spedizione ($${Math.round(shipCost)}) simili`,
    }
  }

  // ─── Save perspective (shipping-cost-focused) ─────────────────────────
  // "Is the shipping cost worth it?"
  let saveDecision: PerspectiveDecision = 'neutral'
  let saveReason = { en: '', it: '' }

  if (shipCost < replaceCost * perspectiveSaveShipThreshold) {
    saveDecision = 'SHIP-ITALY'
    saveReason = {
      en: `Shipping is only $${Math.round(shipCost)} — trivial vs. $${Math.round(replaceCost)} replacement`,
      it: `Spedizione solo $${Math.round(shipCost)} — poco rispetto a $${Math.round(replaceCost)} sostituzione`,
    }
  } else if (shipCost > replaceCost * perspectiveSaveSellThreshold) {
    saveDecision = 'SELL'
    saveReason = {
      en: `Shipping ($${Math.round(shipCost)}) is high relative to replacement ($${Math.round(replaceCost)})`,
      it: `Spedizione ($${Math.round(shipCost)}) alta rispetto alla sostituzione ($${Math.round(replaceCost)})`,
    }
  } else {
    saveReason = {
      en: `Shipping ($${Math.round(shipCost)}) is moderate relative to replacement ($${Math.round(replaceCost)})`,
      it: `Spedizione ($${Math.round(shipCost)}) moderata rispetto alla sostituzione ($${Math.round(replaceCost)})`,
    }
  }

  const ship: Perspective = {
    decision: shipDecision,
    label: { en: 'Ship perspective', it: 'Prospettiva spedizione' },
    reason: shipReason,
  }

  const save: Perspective = {
    decision: saveDecision,
    label: { en: 'Save perspective', it: 'Prospettiva risparmio' },
    reason: saveReason,
  }

  // Agreement: both agree on the same non-neutral action, OR both are neutral
  const agree =
    (shipDecision === saveDecision) ||
    (shipDecision === 'neutral' && saveDecision === 'neutral')

  return { ship, save, agree, hasData: true }
}

/**
 * Should this item be auto-routed to NEEDS-HUMAN because perspectives disagree?
 */
export function shouldAutoNeedsHuman(dual: DualPerspective): boolean {
  if (!dual.hasData) return false
  // Disagree = one says SHIP, other says SELL (not just neutral vs. something)
  const hasShip = dual.ship.decision === 'SHIP-ITALY' || dual.save.decision === 'SHIP-ITALY'
  const hasSell = dual.ship.decision === 'SELL' || dual.save.decision === 'SELL'
  return hasShip && hasSell
}

/**
 * Map perspective agreement to a confidence boost/penalty.
 * Returns a suggested confidence level based on perspective agreement.
 */
export function perspectiveConfidence(
  aiConfidence: 'high' | 'medium' | 'low' | null,
  dual: DualPerspective
): 'high' | 'medium' | 'low' {
  const base = aiConfidence ?? 'medium'
  if (!dual.hasData) return base

  if (dual.agree && dual.ship.decision !== 'neutral') {
    // Both perspectives agree on a clear action → boost confidence
    if (base === 'low') return 'medium'
    return 'high'
  }

  if (!dual.agree) {
    // Perspectives actively disagree → lower confidence
    if (base === 'high') return 'medium'
    return 'low'
  }

  return base
}
