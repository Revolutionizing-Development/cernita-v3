import {
  DecisionRule, RuleCondition, RuleField, RuleOperator,
  RuleSuggestion, Decision, ActionPhase, Entry,
  OverrideTagId, CustomsCategory,
} from './types'

// ─── Rule matching ──────────────────────────────────────────────────────────
//
// Evaluates an item against all enabled rules in priority order.
// Returns the first matching rule, or null if none match.
// Rules use AND logic: all conditions in a rule must match.

/** The item shape we match against — works for both AiResult and Entry */
export interface RuleMatchItem {
  customs_category?: CustomsCategory | null
  replacement_cost?: number | null
  ship_cost?: number | null
  net_cost_ship?: number | null
  weight_lb?: number | null
  voltage_incompatible?: boolean | null
  shipping_restriction?: 'none' | 'restricted' | 'prohibited' | null
  fragility?: 'none' | 'low' | 'medium' | 'high' | 'irreplaceable' | null
  oversized?: boolean | null
}

/** Get the raw value of a field from an item */
function getFieldValue(item: RuleMatchItem, field: RuleField): string | number | boolean | null {
  switch (field) {
    case 'customs_category':     return item.customs_category ?? null
    case 'replacement_cost':     return item.replacement_cost ?? null
    case 'ship_cost':            return item.ship_cost ?? null
    case 'net_cost_ship':        return item.net_cost_ship ?? null
    case 'weight_lb':            return item.weight_lb ?? null
    case 'voltage_incompatible': return item.voltage_incompatible ?? null
    case 'shipping_restriction': return item.shipping_restriction ?? null
    case 'fragility':            return item.fragility ?? null
    case 'oversized':            return item.oversized ?? null
    default:                     return null
  }
}

/** Check if a single condition matches an item */
function matchCondition(item: RuleMatchItem, cond: RuleCondition): boolean {
  const actual = getFieldValue(item, cond.field)
  if (actual == null) return false // null fields never match

  const { operator, value } = cond

  // Boolean comparisons
  if (typeof actual === 'boolean') {
    const expected = typeof value === 'boolean' ? value : value === 'true'
    return operator === 'eq' ? actual === expected : actual !== expected
  }

  // Numeric comparisons
  if (typeof actual === 'number') {
    const expected = typeof value === 'number' ? value : parseFloat(String(value))
    if (isNaN(expected)) return false
    switch (operator) {
      case 'eq':  return actual === expected
      case 'neq': return actual !== expected
      case 'lt':  return actual < expected
      case 'gt':  return actual > expected
      case 'lte': return actual <= expected
      case 'gte': return actual >= expected
      default:    return false
    }
  }

  // String comparisons (category, restriction, fragility)
  const actualStr = String(actual).toLowerCase()
  const expectedStr = String(value).toLowerCase()
  switch (operator) {
    case 'eq':       return actualStr === expectedStr
    case 'neq':      return actualStr !== expectedStr
    case 'contains': return actualStr.includes(expectedStr)
    default:         return false
  }
}

/** Check if all conditions in a rule match an item */
function matchRule(item: RuleMatchItem, rule: DecisionRule): boolean {
  if (rule.conditions.length === 0) return false // empty rules never match
  return rule.conditions.every(cond => matchCondition(item, cond))
}

/**
 * Find the first matching enabled rule for an item.
 * Rules are checked in priority order (lower number = higher priority).
 */
export function findMatchingRule(
  item: RuleMatchItem,
  rules: DecisionRule[]
): DecisionRule | null {
  const enabled = rules
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority)

  for (const rule of enabled) {
    if (matchRule(item, rule)) return rule
  }
  return null
}

/**
 * Check if a rule's decision disagrees with the AI's decision.
 */
export function ruleDisagreesWithAi(
  rule: DecisionRule,
  aiDecision: Decision,
  aiPhase: ActionPhase | null
): boolean {
  if (rule.defaultDecision !== aiDecision) return true
  // Same decision but different phase
  if (rule.defaultPhase && aiPhase && rule.defaultPhase !== aiPhase) return true
  return false
}

// ─── Rule suggestions ───────────────────────────────────────────────────────
//
// Analyzes override patterns in the log to suggest rules.
// A suggestion requires ≥3 overrides with similar characteristics.

/** Minimum overrides needed to trigger a suggestion */
const MIN_PATTERN_COUNT = 3

interface OverridePattern {
  tags: OverrideTagId[]
  decision: Decision
  phase: ActionPhase | null
  entries: Entry[]
}

/**
 * Analyze the log for override patterns and generate rule suggestions.
 * Only looks at entries that were overridden (have override_tags or override_reason).
 */
export function suggestRules(
  entries: Entry[],
  existingRules: DecisionRule[]
): RuleSuggestion[] {
  // Find overridden entries with tags
  const overridden = entries.filter(e =>
    e.override_tags && e.override_tags.length > 0 && e.user_confirmed
  )

  if (overridden.length < MIN_PATTERN_COUNT) return []

  // Group by override_tags + final_decision pattern
  const patterns = new Map<string, OverridePattern>()

  for (const entry of overridden) {
    const tags = (entry.override_tags ?? []).sort() as OverrideTagId[]
    const key = `${tags.join(',')}→${entry.final_decision}:${entry.action_phase ?? ''}`

    if (!patterns.has(key)) {
      patterns.set(key, {
        tags,
        decision: entry.final_decision,
        phase: entry.action_phase ?? null,
        entries: [],
      })
    }
    patterns.get(key)!.entries.push(entry)
  }

  const suggestions: RuleSuggestion[] = []

  for (const pattern of Array.from(patterns.values())) {
    if (pattern.entries.length < MIN_PATTERN_COUNT) continue

    // Check if a similar rule already exists
    const alreadyHandled = existingRules.some(r =>
      r.defaultDecision === pattern.decision &&
      r.enabled
    )
    if (alreadyHandled) continue

    // Build conditions based on the dominant tag pattern
    const conditions = buildConditionsFromTags(pattern.tags, pattern.entries)
    if (conditions.length === 0) continue

    // Generate a human-readable name
    const name = generateRuleName(pattern.tags, pattern.decision, pattern.phase)

    const rule: DecisionRule = {
      id: crypto.randomUUID(),
      name,
      conditions,
      defaultDecision: pattern.decision,
      defaultPhase: pattern.phase,
      priority: 100, // suggested rules get low priority
      enabled: true,
      createdBy: 'suggested',
      acceptedAt: null,
    }

    suggestions.push({
      rule,
      evidence: {
        matchCount: pattern.entries.length,
        exampleItems: pattern.entries.slice(0, 3).map((e: Entry) => e.item_name),
        commonTags: pattern.tags,
      },
    })
  }

  // Sort by match count (most evidence first)
  return suggestions.sort((a, b) => b.evidence.matchCount - a.evidence.matchCount)
}

/** Build rule conditions from override tags and item characteristics */
function buildConditionsFromTags(tags: OverrideTagId[], entries: Entry[]): RuleCondition[] {
  const conditions: RuleCondition[] = []

  if (tags.includes('voltage')) {
    conditions.push({ field: 'voltage_incompatible', operator: 'eq', value: true })
  }

  if (tags.includes('too-heavy')) {
    // Find the median weight of the overridden items
    const weights = entries
      .map(e => e.weight_lb)
      .filter((w): w is number => w != null)
      .sort((a, b) => a - b)
    if (weights.length > 0) {
      const median = weights[Math.floor(weights.length / 2)]
      conditions.push({ field: 'weight_lb', operator: 'gt', value: Math.round(median * 0.8) })
    }
  }

  if (tags.includes('cheap-to-replace')) {
    const costs = entries
      .map(e => e.replacement_cost)
      .filter((c): c is number => c != null)
      .sort((a, b) => a - b)
    if (costs.length > 0) {
      const median = costs[Math.floor(costs.length / 2)]
      conditions.push({ field: 'replacement_cost', operator: 'lt', value: Math.round(median * 1.2) })
    }
  }

  if (tags.includes('expensive-to-ship')) {
    const costs = entries
      .map(e => e.net_cost_ship)
      .filter((c): c is number => c != null)
      .sort((a, b) => a - b)
    if (costs.length > 0) {
      const median = costs[Math.floor(costs.length / 2)]
      conditions.push({ field: 'net_cost_ship', operator: 'gt', value: Math.round(median * 0.8) })
    }
  }

  if (tags.includes('fragile')) {
    conditions.push({ field: 'fragility', operator: 'eq', value: 'high' })
  }

  // If no specific tag-based condition could be built, try common category
  if (conditions.length === 0) {
    const categories = entries
      .map(e => e.customs_category)
      .filter((c): c is CustomsCategory => c != null)
    if (categories.length >= MIN_PATTERN_COUNT) {
      const counts = new Map<CustomsCategory, number>()
      for (const cat of categories) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1)
      }
      const dominant = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]
      if (dominant && dominant[1] >= MIN_PATTERN_COUNT) {
        conditions.push({ field: 'customs_category', operator: 'eq', value: dominant[0] })
      }
    }
  }

  return conditions
}

/** Generate a human-readable name from tags and decision */
function generateRuleName(tags: OverrideTagId[], decision: Decision, phase: ActionPhase | null): string {
  const tagLabels: Record<string, string> = {
    'voltage': 'Voltage incompatible',
    'too-heavy': 'Heavy items',
    'sentimental': 'Sentimental items',
    'cheap-to-replace': 'Cheap to replace',
    'expensive-to-ship': 'Expensive to ship',
    'fragile': 'Fragile items',
    'daily-use': 'Daily use items',
    'consumable': 'Consumable items',
  }

  const decisionLabels: Record<Decision, string> = {
    'SHIP-ITALY': 'Ship',
    'SELL': 'Sell',
    'DONATE': 'Donate',
    'DISPOSE': 'Dispose',
    'GIVE-FAMILY': 'Give to family',
    'CONSUME': 'Use up',
    'NEEDS-HUMAN': 'Discuss',
  }

  const tagPart = tags
    .filter(t => t !== 'other')
    .map(t => tagLabels[t] ?? t)
    .join(' + ') || 'Pattern-matched items'

  const phasePart = phase ? (phase === 'NOW' ? ' now' : ' in Colorado') : ''

  return `${tagPart} → ${decisionLabels[decision]}${phasePart}`
}

// ─── Format helpers ─────────────────────────────────────────────────────────

/** Format a condition as a human-readable string */
export function formatCondition(cond: RuleCondition): string {
  const { field, operator, value } = cond

  const fieldLabels: Record<RuleField, string> = {
    customs_category: 'category',
    replacement_cost: 'replacement',
    ship_cost: 'ocean ship',
    net_cost_ship: 'total to Italy',
    weight_lb: 'weight',
    voltage_incompatible: 'voltage',
    shipping_restriction: 'restriction',
    fragility: 'fragility',
    oversized: 'oversized',
  }

  const opLabels: Record<RuleOperator, string> = {
    eq: '=', neq: '≠', lt: '<', gt: '>', lte: '≤', gte: '≥', contains: '~',
  }

  const fieldStr = fieldLabels[field] ?? field

  // Special formatting for booleans
  if (typeof value === 'boolean') {
    return value ? fieldStr : `not ${fieldStr}`
  }

  // Money formatting for cost/weight fields
  if (['replacement_cost', 'ship_cost', 'net_cost_ship'].includes(field)) {
    return `${fieldStr} ${opLabels[operator]} $${value}`
  }
  if (field === 'weight_lb') {
    return `${fieldStr} ${opLabels[operator]} ${value} lb`
  }

  return `${fieldStr} ${opLabels[operator]} ${value}`
}

/** Format all conditions of a rule into a summary string */
export function formatRuleSummary(rule: DecisionRule): string {
  return rule.conditions.map(formatCondition).join(' AND ')
}
