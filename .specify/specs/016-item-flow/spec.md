# Phased item flow, structured rules, and dual-perspective evaluation

> Redesign the item decision model from a single flat choice into a phased journey that reflects the real lifecycle of belongings across three locations and two moves — with a rules engine that learns from user preferences and a dual-perspective evaluation that surfaces the tension between shipping cost and replacement cost.

| | |
|---|---|
| **Status** | draft |
| **Tier** | 1 (foundational — touches the decision model, AI prompt, evaluation flow, settings, and data schema) |
| **Branch** | `feat/016-item-flow` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-05-06 |
| **Last updated** | 2026-05-06 |
| **Constitution principles** | P1 (user owns the decision — rules are explicit, never silent); P2 (honest math — dual perspective shows both lenses, no hidden weighting); P4 (two people, one truth — preference profiles surface disagreement structurally); P5 (decisions are versioned — rules engine integrates with re-derivation); P9 (safety — voltage, fragility, and restrictions gate decisions); P10 (specs over code); P11 (bilingual); P12 (compliance — customs packing list gates) |
| **Supersedes** | Partially supersedes the decision model in specs 011, 013, 015. The `KEEP-US` decision type is removed. `KEEP-ITALY` is renamed to `SHIP-ITALY`. Spec 015 (Italian customs) is updated to reference `SHIP-ITALY` and the active-use re-evaluation gate. |
| **Depends on** | Spec 006 (locations), Spec 007 (trips/suitcases), Spec 011 (core evaluation), Spec 015 (Italian customs) |

---

## Problem

The current decision model treats each item as a one-time choice from a flat list: KEEP-ITALY, KEEP-US, SELL, DONATE, DISPOSE, GIVE-FAMILY, or NEEDS-HUMAN. But the couple's real situation is phased:

1. **Now (Galesburg, IL):** Items are spread across three locations (The Tudor House, Casa Blanca Storage, Casa Blanca Vault). Some should be sold, donated, or disposed of immediately. Others need to be packed for the move to Colorado.

2. **Colorado (~6 months):** Items arrive and go to the garage (non-climate-controlled), house storage (climate-controlled workroom), or get unpacked for active use. Some items are marked to sell or donate in Colorado. Others are marked for the eventual Italy shipment.

3. **Italy (~2.5 years):** Items confirmed for Italy need a customs-compliant packing list per EU Reg. 1186/2009. But items that were in active use in Colorado need re-evaluation first — a 110V espresso machine shouldn't silently end up on the customs list.

The current model has three specific gaps:

- **`KEEP-US` is meaningless.** There is no "keep in the US permanently." Everything either ships to Italy or gets disposed of before then. Colorado is a waypoint, not a destination.
- **No temporal dimension.** SELL could mean "sell now in Galesburg" or "sell in 2 years in Colorado." The distinction matters for planning.
- **No preference learning.** Each AI evaluation is stateless. The system doesn't know that one partner prioritizes replacement cost while the other prioritizes shipping cost, or that the couple has overridden 8 of 10 kitchen appliance recommendations.

## Why now

1. **The Colorado move is ~6 months away.** The decision model needs to support "pack for Colorado" as a first-class concept, with box placement planning (garage vs. house storage vs. active use).
2. **The couple has divergent optimization goals.** Without surfacing this tension structurally, NEEDS-HUMAN items pile up with no framework for resolution.
3. **Active-use items in Colorado will silently appear on customs lists.** A 110V item marked SHIP-ITALY and placed in ACTIVE-USE should be caught, not shipped.

## User stories

> **US1:** As a user evaluating items in Galesburg, I want the AI to recommend whether to sell/donate now vs. take to Colorado — so I can triage efficiently before the move.

> **US2:** As a user packing boxes for Colorado, I want each box to have a Colorado placement (garage, workroom, active use) — so the movers know where to put each box.

> **US3:** As a user in Colorado, I want to see which items are destined for Italy vs. which will be sold/donated in Colorado — so I can plan the second move.

> **US4:** As the partner who worries about replacement cost, I want the AI to show me "what this would cost to buy again in Italy" prominently — so I can make informed ship-vs-sell decisions.

> **US5:** As the partner who worries about shipping cost, I want the AI to show me "what it costs to ship this" prominently — so I can push back on shipping items that are cheap to replace.

> **US6:** When we disagree, I want the system to route the item to Discuss with both cost perspectives visible — so we can resolve it with math, not arguments.

> **US7:** As a user who keeps overriding the AI for a certain category, I want the system to notice the pattern and suggest a rule — so future evaluations match my preferences automatically.

> **US8:** As a user preparing for the Italy move, I want active-use items to require re-evaluation before appearing on the customs packing list — so voltage-incompatible or worn-out items don't slip through.

---

## Part 1: Revised Decision Model

### Decisions

| Decision | Meaning | Replaces |
|----------|---------|----------|
| `SHIP-ITALY` | This item ultimately ships to Italy. Customs-tracked. | `KEEP-ITALY` |
| `SELL` | Will be sold | `SELL` (unchanged) |
| `DONATE` | Will be donated | `DONATE` (unchanged) |
| `DISPOSE` | Trash / recycle | `DISPOSE` (unchanged) |
| `GIVE-FAMILY` | Give to a family member | `GIVE-FAMILY` (unchanged) |
| `CONSUME` | Will be used up before Italy move (medicine, toiletries, consumables) | New |
| `NEEDS-HUMAN` | Needs discussion between the couple | `NEEDS-HUMAN` (unchanged) |

**Removed:** `KEEP-US`. There is no permanent US retention in this move. Items either ship to Italy or are disposed of (sold, donated, consumed, trashed, given away) before the Italy move.

**Renamed:** `KEEP-ITALY` becomes `SHIP-ITALY`. "Ship" makes the action concrete. The item *will be shipped*.

### Action Phase

SELL, DONATE, and CONSUME can happen now or later. A new field `action_phase` captures when:

| Phase | Meaning |
|-------|---------|
| `NOW` | Do it now, in the current location (Galesburg) |
| `COLORADO` | Do it after moving to Colorado |

Combinations:
- `SELL + NOW` = sell in Galesburg
- `SELL + COLORADO` = sell in Colorado (item travels to CO, then gets sold)
- `DONATE + NOW` = donate in Galesburg
- `DONATE + COLORADO` = donate in Colorado
- `CONSUME` = implicit timing — consumed when it runs out (no phase needed, but `COLORADO` allowed to indicate "take it with us, use it up there")
- `SHIP-ITALY` = no phase needed — timing is the Italy move
- `DISPOSE` = typically `NOW` (no point shipping trash to Colorado)
- `GIVE-FAMILY` = typically `NOW`
- `NEEDS-HUMAN` = no phase (phase is decided during resolution)

The AI can suggest a phase. The user can override it. Phase is nullable — if not set, it means "not yet decided when."

### Decision Labels (bilingual)

| Decision | English | Italian |
|----------|---------|---------|
| `SHIP-ITALY` | Ship to Italy | Spedire in Italia |
| `SELL` + `NOW` | Sell now | Vendi ora |
| `SELL` + `COLORADO` | Sell in Colorado | Vendi in Colorado |
| `DONATE` + `NOW` | Donate now | Dona ora |
| `DONATE` + `COLORADO` | Donate in Colorado | Dona in Colorado |
| `DISPOSE` | Dispose | Smaltisci |
| `GIVE-FAMILY` | Give to family | Dai alla famiglia |
| `CONSUME` | Use up | Consuma |
| `NEEDS-HUMAN` | Needs discussion | Richiede discussione |

### Migration from Current Decisions

| Current value | New value | Notes |
|---------------|-----------|-------|
| `KEEP-ITALY` | `SHIP-ITALY` | Direct rename. All existing items updated. |
| `KEEP-US` | `SELL + COLORADO` | Conservative default. User should review. Flag these items for re-triage. |
| `SELL` | `SELL + NOW` | Assumed current-location sale. |
| `DONATE` | `DONATE + NOW` | Assumed current-location donation. |
| `DISPOSE` | `DISPOSE` | Unchanged. |
| `GIVE-FAMILY` | `GIVE-FAMILY` | Unchanged. |
| `NEEDS-HUMAN` | `NEEDS-HUMAN` | Unchanged. |

---

## Part 2: Box Colorado Placement

### Box Placement

When a box is destined for Colorado (contains items with `action_phase = COLORADO` or `decision = SHIP-ITALY`), it gets a Colorado placement:

| Placement | Climate | Use case |
|-----------|---------|----------|
| `ACTIVE-USE` | Climate-controlled | Unboxed, used in the house |
| `HOUSE-STORAGE` | Climate-controlled | Workroom, closets — stored but in a good environment |
| `GARAGE` | Non-climate-controlled | Garage shelving — tools, durable goods |

Placement is set at the **box level**, not per item. The box's `storage_requirement` field (already exists: `climate_controlled`, `standard`, `garage_ok`) informs valid placements:

- A box with `storage_requirement = climate_controlled` can be placed in `HOUSE-STORAGE` or `ACTIVE-USE` but **not** `GARAGE`. The system warns if the user tries.
- A box with `storage_requirement = garage_ok` can go anywhere.
- A box with `storage_requirement = standard` can go in `HOUSE-STORAGE` or `GARAGE` (standard items tolerate non-climate-controlled environments for limited periods, but the system notes the risk).

### Box Destination Replaces Decision-Based Filtering

Currently, boxes have a `destination` field set to a Decision type (KEEP-ITALY, KEEP-US, etc.) which filters which items can be packed into them. This changes:

- A box's `destination` becomes the **ultimate destiny of its contents**: `SHIP-ITALY`, `SELL`, `DONATE`, `CONSUME`, or `MIXED` (for boxes containing items with different destinies).
- A box can contain items with different ultimate destinies only if explicitly marked `MIXED`. The system discourages this but allows it.
- The `colorado_placement` field is new and separate from `destination`.

---

## Part 3: Active-Use Re-Evaluation Gate

Items placed in `ACTIVE-USE` in Colorado (unboxed, being used daily) have a special status:

1. **They do not appear on the customs packing list** (spec 015) until explicitly re-confirmed for Italy.
2. **A "Re-evaluate for Italy" action** becomes available on each active-use item. This triggers a review that checks:
   - Voltage compatibility (110V items flagged automatically)
   - Current condition (user self-reports: "still good" / "worn out" / "broken")
   - Whether replacement in Italy is cheaper than shipping after 2 years of use
   - Updated weight/value estimates if needed
3. **Re-evaluation is not forced.** The user can re-confirm an item for Italy at any time, or leave it in active-use limbo. But the customs declaration screen (spec 015) shows a clear count: "N active-use items not yet confirmed for Italy."
4. **Items that fail re-evaluation** (voltage incompatible, broken, cheaper to replace) are suggested to change to `SELL + COLORADO` or `DONATE + COLORADO` or `DISPOSE`. The user decides.

### Why This Matters

Without this gate, a 110V espresso machine marked `SHIP-ITALY` two years ago in Galesburg would silently appear on the Italian customs packing list — even though the user has been using it daily at 110V in Colorado and it makes no sense to ship. The re-evaluation gate catches this class of error.

---

## Part 4: Structured Rules Engine

### Rule Structure

A rule is a structured filter that sets a default decision for matching items:

```typescript
interface DecisionRule {
  id: string                    // UUID
  name: string                  // user-visible label, e.g. "Cheap kitchen items → Sell"
  conditions: RuleCondition[]   // ALL must match (AND logic)
  defaultDecision: Decision     // what to suggest
  defaultPhase: ActionPhase | null
  priority: number              // lower = higher priority (rules evaluated in order)
  enabled: boolean
  createdBy: 'user' | 'suggested'  // user-created vs system-suggested
  acceptedAt: string | null     // when a suggested rule was accepted
}

interface RuleCondition {
  field: RuleField
  operator: 'eq' | 'neq' | 'lt' | 'gt' | 'lte' | 'gte' | 'contains'
  value: string | number | boolean
}

type RuleField =
  | 'customs_category'       // e.g. "cucina"
  | 'replacement_cost'       // numeric
  | 'ship_cost'              // numeric
  | 'weight_lb'              // numeric
  | 'voltage_incompatible'   // boolean
  | 'shipping_restriction'   // 'none' | 'restricted' | 'prohibited'
  | 'fragility'              // 'none' | 'low' | 'medium' | 'high' | 'irreplaceable'
  | 'oversized'              // boolean
```

### Example Rules

| Rule | Conditions | Decision |
|------|-----------|----------|
| "Voltage incompatible items" | `voltage_incompatible = true` | `SELL + COLORADO` |
| "Cheap kitchen items" | `customs_category = cucina` AND `replacement_cost < 50` | `SELL + NOW` |
| "Books always ship" | `customs_category = libri` | `SHIP-ITALY` |
| "Prohibited items" | `shipping_restriction = prohibited` | `SELL + NOW` |
| "Heavy cheap items" | `weight_lb > 40` AND `replacement_cost < 100` | `DONATE + NOW` |

### How Rules Integrate with AI Evaluation

1. After the AI returns its recommendation, the system checks if any enabled rules match the item.
2. If a rule matches and **disagrees** with the AI recommendation, the rule's decision is shown as the primary suggestion, with the AI's original recommendation shown as an alternative: "Your rule says SELL. AI suggested SHIP-ITALY."
3. If no rule matches, the AI recommendation stands.
4. The user always has final say (P1).
5. Rules are injected into the AI prompt as context, so the AI can factor them into its reasoning — but rule enforcement is client-side, not dependent on the AI following instructions.

### Rules UI in Settings

```
┌─ Decision Rules ──────────────────────────────────────────┐
│                                                            │
│  ☑ Voltage incompatible → Sell in Colorado                 │
│    voltage_incompatible = true                     [Edit]  │
│                                                            │
│  ☑ Cheap kitchen items → Sell now                          │
│    category = Kitchen AND replacement < $50        [Edit]  │
│                                                            │
│  ☐ Heavy items → Donate  (disabled)                        │
│    weight > 40 lb AND replacement < $100           [Edit]  │
│                                                            │
│  ┌─ Suggested ─────────────────────────────────────────┐   │
│  │  Based on your overrides:                           │   │
│  │  "You changed 6/8 kitchen electronics to SELL       │   │
│  │   (tagged: voltage, cheap to replace)"              │   │
│  │                                                     │   │
│  │  Suggested rule: Kitchen electronics → SELL         │   │
│  │  [Accept]  [Dismiss]                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  [+ Add rule]                                              │
└────────────────────────────────────────────────────────────┘
```

### Rule Storage

Rules are stored in `CernitaSettings` (localStorage, synced via the settings sharing mechanism). No database table needed for v1 — rule count is small (likely <20).

---

## Part 5: Dual-Perspective Evaluation

### The Tension

The couple has complementary but conflicting optimization goals:

| Partner | Priority | Favors |
|---------|----------|--------|
| Partner A (user) | Replacement cost | Ship it — buying again in Italy is expensive |
| Partner B (wife) | Shipping cost | Sell it — shipping is expensive, buy cheaper there |

### How It Works

The AI evaluation already computes `ship_cost` and `replacement_cost`. The result card gains a **dual-perspective section** that shows both viewpoints:

```
┌─ Perspectives ────────────────────────────────────────┐
│                                                        │
│  📦 Ship perspective:                                  │
│  "Costs $135 more to replace in Italy than to ship"    │
│  Suggests: SHIP-ITALY                                  │
│                                                        │
│  💰 Save perspective:                                  │
│  "Costs $85 to ship, only $40 to replace locally"      │
│  Suggests: SELL                                        │
│                                                        │
│  ⚠ Perspectives disagree                               │
└────────────────────────────────────────────────────────┘
```

### Auto-NEEDS-HUMAN on Disagreement

When the two perspectives produce **different decisions**, the AI's default recommendation becomes `NEEDS-HUMAN` with both perspectives shown. This routes the item to the Discuss tab where the couple can resolve it together with the math visible.

When both perspectives **agree** (e.g., a $10 spatula: cheap to ship AND cheap to replace → SELL either way), the confidence is higher and the recommendation is straightforward.

### Perspective Calculation

The system derives perspective recommendations using these rules:

**Ship perspective (replacement-cost-focused):**
- If `replacement_cost > ship_cost * 1.5` → SHIP-ITALY ("significantly cheaper to ship than replace")
- If `replacement_cost <= ship_cost * 0.5` → SELL ("much cheaper to replace")
- Otherwise → neutral (no strong opinion from this lens)

**Save perspective (shipping-cost-focused):**
- If `ship_cost > replacement_cost * 0.7` → SELL ("shipping cost approaches replacement cost")
- If `ship_cost < replacement_cost * 0.3` → SHIP-ITALY ("shipping is trivially cheap")
- Otherwise → neutral

The thresholds (1.5x, 0.5x, 0.7x, 0.3x) are configurable in Settings under "Perspective Thresholds." These are not hidden — they're shown and labeled per P2.

### What It Does NOT Do

- It does not average the two preferences into a blended score (that would be P2 violation — hidden weighting).
- It does not assign one partner's preference to one login (both partners see both lenses on every item).
- It does not replace the AI's judgment — it adds a structured economic comparison on top.

---

## Part 6: Override Tags and Pattern Detection

### Override Tags

When the user overrides an AI decision, the override reason field gains structured tags in addition to free text:

| Tag | Meaning |
|-----|---------|
| `voltage` | Voltage incompatible with Italy |
| `too-heavy` | Not worth shipping due to weight |
| `sentimental` | Keeping despite unfavorable economics |
| `cheap-to-replace` | Cheaper to buy new in Italy |
| `expensive-to-ship` | Shipping cost too high |
| `fragile` | Too fragile to survive shipping |
| `daily-use` | Needed daily, can't pack yet |
| `consumable` | Will be used up before Italy |
| `other` | Free-text reason only |

Tags are multi-select. At least one tag is required when overriding (free text remains optional). Tags are stored on the entry alongside `override_reason`.

### Pattern Detection

The system tracks override patterns and surfaces rule suggestions when a pattern emerges:

1. **Threshold:** After 5+ overrides with the same tag within a category (or across all items for non-category tags), the system generates a suggested rule.
2. **Suggestion format:** "You've tagged [tag] on [N] overrides in [category], all changed to [decision]. Suggested rule: [category] + [tag] → [decision]."
3. **User action:** Accept (rule becomes active), Dismiss (suggestion disappears, won't resurface for same pattern), or Snooze (ask me again after 5 more overrides).
4. **Suggestions appear** in Settings → Decision Rules (bottom section) and as a non-blocking banner on the Evaluate page after saving an override.

---

## Part 7: Colorado Move Cost Estimation

### Why Track Everything Going to Colorado

The cost of the Colorado move depends on the total weight and volume of ALL items going, regardless of ultimate destiny. A box of toilet paper (CONSUME) and a box of heirloom china (SHIP-ITALY) both take up space on the moving truck.

### Dashboard Integration

The Dashboard gains a "Colorado Move" summary card:

```
┌─ Colorado Move Estimate ──────────────────────────────┐
│                                                        │
│  Items going to Colorado:  142                         │
│  Estimated weight:         2,340 lb                    │
│  Estimated volume:         186 cu ft                   │
│                                                        │
│  By placement:                                         │
│    🏠 Active use:     34 items · 480 lb                │
│    🗄️ House storage:  62 items · 1,120 lb              │
│    🚗 Garage:         46 items · 740 lb                │
│                                                        │
│  By ultimate destiny:                                  │
│    🇮🇹 Ship to Italy:  89 items                        │
│    💰 Sell in CO:      28 items                         │
│    🎁 Donate in CO:    12 items                        │
│    🧴 Consume:         13 items                        │
│                                                        │
│  Moving cost estimate:  $X,XXX                         │
│  (based on $Y/lb or $Z/cu ft, whichever is greater)   │
└────────────────────────────────────────────────────────┘
```

### Settings: Colorado Move Rates

New settings fields:
- `coloradoMoveRatePerLb: number` — cost per pound for the IL → CO move
- `coloradoMoveRatePerCuFt: number` — cost per cubic foot
- `coloradoMoveFlatFee: number` — flat fee component (truck rental, etc.)

---

## Part 8: Onboarding and Help

### The Problem

The dual-perspective logic, phased decisions, structured rules, and override learning are powerful — but only if both users understand them. One partner designed this system; the other is opening the app for the first time. Without onboarding, the wife sees a result card with "Ship perspective" and "Save perspective" and has no idea why two conflicting recommendations are shown, or what the tags mean when overriding, or why some items go to "Needs discussion."

### First-Time Walkthrough

On first login (detected via a `hasSeenOnboarding` flag in localStorage per device), the app shows a guided walkthrough — a series of full-screen cards the user swipes through. Not a tooltip tour (those are easy to dismiss and forget). Not a video (can't skim). A sequence of illustrated cards with short text, each explaining one concept:

**Card 1 — Welcome**
> "Cernita helps you decide what to keep, sell, ship, or donate — across your move from Galesburg to Colorado to Italy."
> *"Cernita ti aiuta a decidere cosa tenere, vendere, spedire o donare — nel trasloco da Galesburg al Colorado all'Italia."*

**Card 2 — The Journey**
> Visual: simplified version of the three-phase flow diagram
> "Your items have a journey: some leave now (sell, donate). Others travel to Colorado. From Colorado, some ship to Italy — others get sold or used up before the final move."

**Card 3 — Two Perspectives**
> Visual: a single item showing ship-cost vs. replace-cost
> "Every item is evaluated from two angles: what it costs to ship, and what it costs to replace in Italy. When these perspectives disagree, the item goes to the Discuss tab — so you can decide together."

**Card 4 — Discuss**
> Visual: the Discuss tab icon with the badge
> "Items marked 'Needs discussion' appear in the Discuss tab. Both of you see the same math. You resolve it together — the app never decides for you."

**Card 5 — Overrides and Learning**
> "If the AI gets it wrong, override the decision and tag why (voltage, too heavy, sentimental...). After enough overrides, the app suggests rules to match your preferences."

**Card 6 — You're ready**
> "Start by evaluating items — point the camera, and Cernita does the math."
> [Get started · Iniziamo]

### On-Demand Help

The same content is available at any time from:
1. **Nav → Help icon** (a `?` or `ℹ` in the nav bar or settings)
2. **Settings → Help & Guide section** — expandable accordion with the same cards as browseable sections
3. **Contextual help links** — small `ℹ` icons next to complex UI elements that link directly to the relevant help section:
   - Next to "Perspectives" section on result card → Card 3
   - Next to override tags → Card 5
   - Next to Discuss tab badge → Card 4
   - Next to phase picker (NOW / COLORADO) → Card 2

### Contextual First-Use Hints

Beyond the initial walkthrough, specific features show a one-time hint on first encounter:

- **First override:** A brief callout above the tag picker: "Pick a tag for why you're changing the decision — this helps Cernita learn your preferences."
- **First Discuss item:** A callout on the Discuss tab: "Items land here when the economics could go either way. Review the math and decide together."
- **First rule suggestion:** A callout in Settings: "This rule was suggested based on your override patterns. Accept it to automate future evaluations, or dismiss it."

Hints are dismissed with a tap and don't reappear (tracked in localStorage).

### Design Principles for Onboarding

- **No jargon.** "Perspectives" not "dual-lens optimization." "What it costs to ship" not "ship_cost delta."
- **Bilingual.** Every onboarding card has English primary, Italian secondary — the wife may be more comfortable in Italian for some concepts.
- **Skippable but not invisible.** The walkthrough has a "Skip" link on every card, but it's shown prominently enough that the user knows it exists. The help section is always accessible.
- **Not patronizing.** The tone is "here's how this works" not "let us teach you." Both users are intelligent adults making consequential decisions — the onboarding respects that.
- **Constitution P1 alignment.** The onboarding explicitly states: "the app never decides for you" and "you can always override." This sets the right expectation from minute one.

---

## Acceptance Criteria

### Decision Model (Part 1)

- [ ] **AC1** `KEEP-ITALY` is renamed to `SHIP-ITALY` throughout the codebase and database. All existing entries are migrated. CSS classes, labels, badge styles, and AI prompt references updated.

- [ ] **AC2** `KEEP-US` is removed as a valid decision. Existing `KEEP-US` entries are migrated to `SELL` with `action_phase = 'COLORADO'` and flagged for user review via a one-time banner: "N items were previously marked 'Keep US' and have been changed to 'Sell in Colorado'. Please review."

- [ ] **AC3** `CONSUME` is added as a new decision type with bilingual labels ("Use up / Consuma"), badge styling, and proper handling throughout Log, Dashboard, Evaluate, and Discuss.

- [ ] **AC4** `action_phase` column added to `cernita_entries`: nullable text, values `'NOW'` or `'COLORADO'`. The AI evaluation returns a suggested phase. The user can set or change it in the detail overlay.

- [ ] **AC5** The Evaluate result card shows the phase alongside the decision: "Sell now · Vendi ora" or "Sell in Colorado · Vendi in Colorado". Phase is editable in the override overlay.

- [ ] **AC6** The Log page gains a phase filter pill: "Now" / "Colorado" / "All" — so the user can see "what do I need to deal with before the move."

### Box Placement (Part 2)

- [ ] **AC7** `colorado_placement` column added to `cernita_boxes`: nullable text, values `'ACTIVE-USE'`, `'HOUSE-STORAGE'`, `'GARAGE'`. Shown in BoxCard and BoxDetailOverlay.

- [ ] **AC8** When setting a box's `colorado_placement` to `GARAGE`, the system checks `storage_requirement`. If `climate_controlled`, a warning is shown: "This box requires climate control. Garage placement risks damage to: [list item names]." The user can proceed (P1) but the warning is logged.

- [ ] **AC9** Box creation and editing gains a "Colorado placement" picker (three options with icons and climate indicators).

### Active-Use Gate (Part 3)

- [ ] **AC10** Items with `decision = SHIP-ITALY` inside a box with `colorado_placement = ACTIVE-USE` gain an `italy_confirmed` boolean (default `false`). These items do NOT appear in the customs declaration (spec 015) until `italy_confirmed = true`.

- [ ] **AC11** The customs review screen (spec 015) shows: "N active-use items not yet confirmed for Italy. [Review]" with a link to a confirmation flow.

- [ ] **AC12** The confirmation flow for each active-use item shows: current voltage compatibility status, condition self-report (dropdown: good / worn / broken), current ship-vs-replace economics, and a confirm/change-decision action.

- [ ] **AC13** Voltage-incompatible active-use items are shown with a prominent warning during confirmation: "This is a 110V item. Italy uses 220V/50Hz. Ship anyway, or change decision?"

### Structured Rules (Part 4)

- [ ] **AC14** Settings gains a "Decision Rules" section where users can create, edit, enable/disable, and delete rules.

- [ ] **AC15** Rule creation UI: select a field (category, replacement cost, weight, voltage, etc.), an operator (equals, less than, greater than, contains), a value, and a default decision + phase. Rules can have multiple conditions (AND logic).

- [ ] **AC16** After AI evaluation, matched rules are checked. If a rule disagrees with the AI, the rule's suggestion is shown as primary with the AI's as secondary: "Your rule says: SELL. AI suggested: SHIP-ITALY. [Confirm SELL] [Use AI suggestion] [Override]"

- [ ] **AC17** Rules are injected into the AI prompt as additional context: "User rules in effect: voltage_incompatible items → SELL; kitchen items under $50 → SELL." This allows the AI to factor rules into its reasoning, but rule enforcement is client-side.

- [ ] **AC18** Rules are stored in `CernitaSettings` and sync between devices via localStorage.

### Dual Perspective (Part 5)

- [ ] **AC19** The Evaluate result card gains a "Perspectives" section showing both the ship-perspective (replacement-cost-focused) and save-perspective (shipping-cost-focused) recommendations with one-line explanations.

- [ ] **AC20** When perspectives disagree, the AI's default recommendation becomes `NEEDS-HUMAN`. The Discuss card for these items shows both perspectives prominently.

- [ ] **AC21** When perspectives agree, the confidence indicator reflects the agreement (agreement → higher confidence).

- [ ] **AC22** Perspective thresholds are configurable in Settings under "Perspective Thresholds" with default values and clear labels explaining what each threshold means. The thresholds are visible per P2.

### Override Tags (Part 6)

- [ ] **AC23** The override overlay gains a tag picker (multi-select pills) above the free-text reason field. Tags: voltage, too-heavy, sentimental, cheap-to-replace, expensive-to-ship, fragile, daily-use, consumable, other. At least one tag is required.

- [ ] **AC24** `override_tags` column added to `cernita_entries`: nullable text array (stored as JSON in Supabase).

- [ ] **AC25** After 5+ overrides with the same tag within a customs category, the system generates a suggested rule and displays it in Settings → Decision Rules and as a subtle banner after saving an override.

- [ ] **AC26** Suggested rules can be accepted (becomes an active rule), dismissed (won't resurface for this pattern), or snoozed (ask again after 5 more).

### Colorado Move Cost (Part 7)

- [ ] **AC27** Settings gains Colorado move rate fields: per-lb rate, per-cu-ft rate, and flat fee.

- [ ] **AC28** Dashboard gains a "Colorado Move" summary card showing item count, total weight, total volume, breakdown by placement and destiny, and estimated move cost.

- [ ] **AC29** Items with `action_phase = 'COLORADO'` or `decision = 'SHIP-ITALY'` or `decision = 'CONSUME'` all count toward the Colorado move estimate (everything going to Colorado, regardless of ultimate destiny).

### Onboarding and Help (Part 8)

- [ ] **AC30** On first login (no `hasSeenOnboarding` flag in localStorage), the app shows a full-screen walkthrough of 6 cards covering: the three-phase journey, dual perspectives, the Discuss tab, overrides and learning, and a "get started" action. Each card has English primary and Italian secondary text. A "Skip" link is available on every card.

- [ ] **AC31** The walkthrough sets `hasSeenOnboarding = true` in localStorage on completion or skip. It does not reappear unless the user clears localStorage or explicitly replays it from Settings.

- [ ] **AC32** Settings gains a "Help & Guide" section with the same onboarding content as an expandable accordion (browseable at any time). A "Replay walkthrough" button resets the flag and shows the full sequence again.

- [ ] **AC33** Contextual `ℹ` icons appear next to complex UI elements: the Perspectives section on the result card, the override tag picker, the Discuss tab badge, and the phase picker. Each links to the relevant help section.

- [ ] **AC34** First-use hints appear once per feature on first encounter: a callout above the override tag picker ("Pick a tag..."), a callout on the Discuss tab ("Items land here when..."), and a callout on the first rule suggestion ("This rule was suggested..."). Each is dismissible and tracked in localStorage.

- [ ] **AC35** All onboarding and help content is bilingual (English primary, Italian secondary) per P11. No jargon — uses plain language for all concepts.

---

## Data Model Changes

### Migration 016: Item flow redesign

```sql
-- Migration 016: Phased item flow
-- Renames KEEP-ITALY → SHIP-ITALY, removes KEEP-US, adds action_phase and override_tags

-- 1. Rename KEEP-ITALY → SHIP-ITALY
UPDATE cernita_entries
  SET final_decision = 'SHIP-ITALY'
  WHERE final_decision = 'KEEP-ITALY';

-- 2. Migrate KEEP-US → SELL with phase COLORADO
-- These items need user review — flag them
UPDATE cernita_entries
  SET final_decision = 'SELL',
      override_reason = COALESCE(override_reason || ' | ', '') || '[AUTO-MIGRATED from KEEP-US — please review]'
  WHERE final_decision = 'KEEP-US';

-- 3. Add action_phase column
ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS action_phase text
  CHECK (action_phase IN ('NOW', 'COLORADO'));

-- 4. Set default phases for existing SELL/DONATE entries
UPDATE cernita_entries SET action_phase = 'NOW' WHERE final_decision = 'SELL' AND action_phase IS NULL;
UPDATE cernita_entries SET action_phase = 'NOW' WHERE final_decision = 'DONATE' AND action_phase IS NULL;

-- 5. Add override_tags column (JSON array of tag strings)
ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS override_tags jsonb DEFAULT NULL;

-- 6. Add italy_confirmed for active-use gate
ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS italy_confirmed boolean DEFAULT false;

-- 7. Add colorado_placement to boxes
ALTER TABLE cernita_boxes
  ADD COLUMN IF NOT EXISTS colorado_placement text
  CHECK (colorado_placement IN ('ACTIVE-USE', 'HOUSE-STORAGE', 'GARAGE'));

-- 8. Update box destination values
UPDATE cernita_boxes
  SET destination = 'SHIP-ITALY'
  WHERE destination = 'KEEP-ITALY';

-- Note: KEEP-US boxes need manual review — they may contain mixed-destiny items
UPDATE cernita_boxes
  SET destination = 'SELL',
      notes = COALESCE(notes || ' | ', '') || '[AUTO-MIGRATED from KEEP-US — review contents]'
  WHERE destination = 'KEEP-US';

-- 9. Update customs index for new decision name
DROP INDEX IF EXISTS idx_cernita_entries_customs_category;
CREATE INDEX IF NOT EXISTS idx_cernita_entries_customs_category
  ON cernita_entries (customs_category)
  WHERE final_decision = 'SHIP-ITALY';

-- 10. Index for phase-based queries
CREATE INDEX IF NOT EXISTS idx_cernita_entries_action_phase
  ON cernita_entries (action_phase)
  WHERE action_phase IS NOT NULL;
```

### CernitaSettings Additions

```typescript
// New fields in CernitaSettings:
interface CernitaSettings {
  // ... existing fields ...

  // Decision rules (Part 4)
  decisionRules: DecisionRule[]

  // Perspective thresholds (Part 5)
  perspectiveShipThreshold: number    // default 1.5 — ship if replacement > ship * this
  perspectiveSellThreshold: number    // default 0.5 — sell if replacement < ship * this
  perspectiveSaveShipThreshold: number // default 0.3 — ship if ship < replacement * this
  perspectiveSaveSellThreshold: number // default 0.7 — sell if ship > replacement * this

  // Colorado move rates (Part 7)
  coloradoMoveRatePerLb: number      // default 0
  coloradoMoveRatePerCuFt: number    // default 0
  coloradoMoveFlatFee: number        // default 0
}
```

### Updated Decision Type

```typescript
export type Decision =
  | 'SHIP-ITALY'
  | 'SELL'
  | 'DONATE'
  | 'DISPOSE'
  | 'GIVE-FAMILY'
  | 'CONSUME'
  | 'NEEDS-HUMAN'

export type ActionPhase = 'NOW' | 'COLORADO'
```

---

## UI States

### State A — Evaluate Result Card (updated)

The existing result card layout gains:
1. **Phase badge** next to the decision badge: "Sell now" or "Sell in Colorado"
2. **Dual perspective section** below the economics table
3. **Rule match indicator** if a user rule matched: "Matched rule: [rule name]"

### State B — Override Overlay (updated)

The existing override overlay gains:
1. **Phase picker** ("Now" / "Colorado") below the decision dropdown
2. **Tag picker** (multi-select pills) above the free-text reason field
3. At least one tag required to submit

### State C — Settings: Decision Rules

New section in Settings between "Economic Rates" and "Customs Declaration":
1. List of active rules with enable/disable toggles
2. Collapsed "Suggested rules" section (appears only when suggestions exist)
3. "Add rule" button → rule editor sheet

### State D — Settings: Perspective Thresholds

New subsection under Decision Rules:
1. Four threshold sliders with labels explaining what each does
2. "Reset to defaults" link

### State E — Settings: Colorado Move Rates

New subsection under Economic Rates:
1. Three fields: per-lb rate, per-cu-ft rate, flat fee
2. A live estimate based on current item data: "With current items, estimated move cost: $X,XXX"

### State F — Dashboard: Colorado Move Card

New card on the Dashboard (between existing cards):
1. Item count, total weight, total volume
2. Breakdown by Colorado placement (three bars)
3. Breakdown by ultimate destiny (four counts)
4. Move cost estimate

### State G — Log Filter: Phase

New filter pill row (below existing decision filter):
1. "All" / "Now" / "Colorado" / "No phase set"
2. Combines with existing decision filter

### State H — Box Colorado Placement Picker

In box creation/editing:
1. Three large tappable options with icons: House (active use), Workroom (house storage), Garage
2. Climate compatibility indicator per option (green check / amber warning)
3. Warning modal if climate-controlled box placed in garage

### State I — Active-Use Confirmation Flow

Reached from customs review screen:
1. List of active-use SHIP-ITALY items not yet confirmed
2. Per item: voltage status, condition dropdown, economics summary
3. "Confirm for Italy" / "Change decision" actions per item
4. Bulk action: "Confirm all compatible items" (skips voltage-incompatible)

### State J — First-Time Walkthrough

Full-screen card sequence, shown on first login:
1. Each card has a large illustration area (top 60%), title, body text (EN + IT), and a "Next" button
2. A "Skip" link in the top-right corner on every card
3. Progress dots at the bottom (6 dots, current highlighted in terracotta)
4. Final card has "Get started · Iniziamo" as the primary action
5. Background is `var(--paper)`, text is `var(--ink)`, accents are terracotta

### State K — Settings: Help & Guide

Expandable accordion section in Settings:
1. Six sections matching the walkthrough cards, each collapsible
2. Content identical to walkthrough but in browseable format
3. "Replay full walkthrough" button at the bottom
4. Contextual help links from other screens deep-link to specific sections

### State L — Contextual First-Use Hints

Floating callout boxes (not modals — they don't block interaction):
1. Arrow pointing to the relevant UI element
2. One or two sentences of explanation (EN + IT)
3. "Got it" dismiss button
4. Semi-transparent backdrop behind the callout only (not full screen)

---

## Edge Cases

- **EC1** Item has `decision = SHIP-ITALY` but `voltage_incompatible = true`. → Allowed (user might plan to buy a transformer). Dual perspective flags it. If a rule exists for voltage items, the rule fires. No hard block — P1 applies.

- **EC2** Item has `decision = CONSUME` and `action_phase = null`. → Valid. The item will be consumed; timing is implicit. No need to force a phase.

- **EC3** Box has `colorado_placement = GARAGE` and `storage_requirement = climate_controlled`. → Warning shown, user can proceed. The item's `survival_risk` field should already flag this concern.

- **EC4** No rules exist. → The evaluation flow works exactly as today (AI recommendation only). The dual perspective section still shows. The system never requires rules.

- **EC5** All items are `SHIP-ITALY`. → Colorado move cost still calculated (they still have to get there). The "Sell/Donate in Colorado" breakdowns show zero.

- **EC6** User accepts a suggested rule but then overrides items that match it. → The rule is not auto-disabled. The user can disable or edit it manually. The system may eventually suggest a modified rule if the new override pattern is consistent.

- **EC7** Both perspectives say `NEEDS-HUMAN`. → This can happen if neither lens has a strong opinion (costs are similar). The item defaults to `NEEDS-HUMAN` with a note: "Economics are neutral — this is a preference decision."

- **EC8** Item has no `ship_cost` or `replacement_cost`. → Dual perspective section shows "Insufficient data for comparison." No perspective-based NEEDS-HUMAN routing — the AI's standalone recommendation applies.

- **EC9** Migration: item was `KEEP-US` and had no `action_phase`. → Migrated to `SELL + COLORADO`. The user sees a review banner on first app load after migration.

- **EC10** User deletes all rules. → System reverts to AI-only recommendations. Suggested rules can still appear based on override patterns.

- **EC11** A `CONSUME` item is accidentally packed in a `SHIP-ITALY` box. → The system warns: "This box is destined for Italy but contains consumable items that won't ship: [item names]. Move them or change the box destination."

- **EC12** Active-use item re-evaluated and confirmed for Italy, then the user changes the box placement from `ACTIVE-USE` to `HOUSE-STORAGE`. → `italy_confirmed` stays `true`. The item remains on the customs list. This is correct — the user decided to stop using it and store it for shipping.

- **EC13** The move timeline compresses (user moves to Italy sooner than expected). → Active-use items without `italy_confirmed` need a sweep. The customs review screen already shows the count. A "Confirm all" bulk action is available for items without blocking flags (voltage, restriction).

- **EC14** User skips the onboarding walkthrough. → All features work normally. Contextual `ℹ` links and first-use hints still appear. The full walkthrough is replayable from Settings → Help & Guide.

- **EC15** User clears localStorage (or logs in on a new device). → `hasSeenOnboarding` flag is gone, walkthrough shows again. This is correct behavior — the new device doesn't know what the user has seen. First-use hints also reset.

- **EC16** Both partners log in on the same physical device (shared tablet). → Each sees the walkthrough once on that device (it's per-device, not per-user). The help section is always available regardless.

- **EC17** The app is updated and new features are added after the user completed onboarding. → New first-use hints can appear for new features without replaying the full walkthrough. A "What's new" section in Help shows changes since last seen (tracked by app version in localStorage).

---

## Out of Scope

- **Per-partner preference profiles.** Both partners see both lenses on every item. The system does not assign a preference to a login. If partner-specific views are needed later, that's a separate spec.
- **AI context injection from past decisions (Layer 3 learning).** Deferred. Injecting decision history into the AI prompt is powerful but risks P2 violations. Structured rules (Layer 1) and pattern detection (Layer 2) come first.
- **Automatic rule application without user confirmation.** Rules suggest; the user confirms. No silent auto-decision.
- **Moving company rate integration.** Colorado move cost uses user-entered rates, not live quotes from movers.
- **Per-item Colorado placement.** Placement is at the box level. Loose items (no box) inherit placement from their location, or are unassigned.
- **Multiple Colorado locations.** v1 assumes one Colorado address with three zones (garage, house storage, active use). Multiple addresses (e.g., separate storage unit) would be a spec extension.

---

## Open Questions

- **Q1:** Should the `CONSUME` decision have a sub-type for "medicine" vs. "toiletries" vs. "food" — since different consumable categories have different customs implications if accidentally packed?
  **Draft answer:** No sub-types in v1. The customs declaration already excludes non-SHIP-ITALY items. If a consumable ends up in an Italy box, EC11 catches it.

- **Q2:** Should override tags be extensible (user can create custom tags) or fixed?
  **Draft answer:** Fixed set for v1. Custom tags would complicate pattern detection. If users consistently use "other" with similar free-text, that's a signal to add a new tag in v2.

- **Q3:** Should the dual-perspective thresholds be per-category (e.g., stricter for electronics, looser for books)?
  **Draft answer:** Global thresholds for v1. Per-category thresholds add complexity without clear value until the user has enough data to know which categories need tuning.

- **Q4:** Should the Colorado move cost estimate account for items currently in active use (not in a box)?
  **Draft answer:** Yes. Active-use items still traveled to Colorado and cost money to move. They should be included in the estimate even though they're not in a box.

- **Q5:** The Constitution currently says "Lubbock, Texas" as the intermediate US destination, but the actual destination is now Colorado. Should a constitutional amendment be proposed?
  **Draft answer:** Yes. The Constitution's Purpose section should be updated to reflect "Colorado" (the `usDestination` setting already defaults to "Colorado Springs"). This is a factual correction, not a principle change — a minor amendment.

---

## References

- **Constitution Principles 1, 2, 4, 5, 9, 10, 11, 12** — all touched
- **Spec 011 (core evaluation)** — decision model origin
- **Spec 013 (log tab)** — filter system, detail overlay
- **Spec 014 (settings tab)** — settings structure
- **Spec 015 (Italian customs)** — customs packing list, now gated by active-use confirmation
- **Spec 006 (locations)** — current location tracking
- **Spec 007 (trips/suitcases)** — air shipment assignments
