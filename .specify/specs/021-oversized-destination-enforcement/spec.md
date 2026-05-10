# Spec 021 — Oversized Items & Destination Enforcement

**Status:** Shipped (retroactive spec)
**Priority:** P1
**Dependencies:** 011 (core evaluation), 013 (log tab), 016 (item flow)

## Problem

Two related packing constraints need enforcement:

1. **Oversized items** can't physically fit in a standard 27-gallon plastic moving box. They ship separately and must not be assigned to boxes.
2. **Destination enforcement** ensures items go into the right containers. SHIP-ITALY items can only go in SHIP-ITALY boxes. GIVE-FAMILY items can only go in suitcases. SELL/DONATE/DISPOSE/CONSUME items should never be packed at all.

Without these rules, users could accidentally pack a dining table into a box, or put a "SELL" item into a shipping container bound for Italy.

## User Stories

### US-1: Oversized detection
> As a user, I want the AI to flag items too large for a standard box so I know they need special handling and don't try to box them.

### US-2: Oversized packing prevention
> As a user, I want the system to prevent me from assigning an oversized item to a box, so I don't create an impossible packing list.

### US-3: Destination-matched packing
> As a user, I want to only see compatible boxes when assigning an item, so I can't accidentally put a SELL item into a SHIP-ITALY box.

### US-4: Non-packable items
> As a user, I want SELL, DONATE, DISPOSE, and CONSUME items to skip the box assignment step entirely, since they're not being packed.

### US-5: Suitcase-only enforcement
> As a user, I want GIVE-FAMILY items to only be assignable to suitcases (not plastic boxes), since they travel with a person.

## Acceptance Criteria

### Oversized Items

#### AC-1: AI detection
The AI prompt defines oversized as items that cannot fit inside a standard 27-gallon plastic moving box (roughly 24" x 16" x 12"). Returns `"oversized": true` or `false` for every item.

#### AC-2: Examples in prompt
The AI prompt includes explicit examples:
- **Oversized:** rugs, rolled carpets, sofas, armchairs, bed frames, large mirrors, bicycles, golf bags, surfboards, rolled canvases >20"x30", standing lamps, large potted plants, kayaks
- **Not oversized:** standard household items that fit in a box, even if heavy

#### AC-3: Badge in Log
Oversized items show a `◱` badge in the Log entry row, alongside other condition badges (outdated, override, voltage, hazmat).

#### AC-4: Box assignment blocked
In both the post-save prompt (evaluate page) and the Log detail overlay:
- Oversized items show "Oversized — ships separately" note
- No box selector dropdown is rendered
- The item cannot be assigned to any box

#### AC-5: Post-save behavior
After saving an oversized item on the evaluate page:
- Show oversized note with explicit "Continue" button
- No auto-reset to camera (unlike non-packable items)
- Forces user acknowledgment before proceeding

#### AC-6: Database field
`cernita_entries.oversized` — boolean, defaults to `false`. Added by migration-011-oversized.sql.

#### AC-7: Decision rules integration
`oversized` is available as a `RuleField` for decision rules, with operators `eq` only (boolean). Users can create rules like "If oversized = true, then SELL".

### Destination Enforcement

#### AC-8: Compatibility function
A `getCompatibleBoxes(boxes, decision)` function filters the box list:

| Item Decision | Compatible Boxes |
|---------------|-----------------|
| SHIP-ITALY | Open boxes with `destination === 'SHIP-ITALY'` |
| GIVE-FAMILY | Open suitcases only (`box_type === 'suitcase'`) |
| NEEDS-HUMAN | Any open box (no filtering) |
| SELL, DONATE, DISPOSE, CONSUME | None — these are non-packable |

#### AC-9: Non-packable constant
`NON_PACKABLE = ['SELL', 'DONATE', 'DISPOSE', 'CONSUME']` — items with these decisions are never offered a box selector.

#### AC-10: Non-packable UI messaging
In the Log detail overlay, non-packable items show contextual text instead of a box selector:
- SELL: "Being sold — not packed into a box"
- DONATE: "Being donated — not packed"
- CONSUME: "Being used up — not packed"
- DISPOSE: "Being disposed — not packed"

#### AC-11: Post-save auto-reset
After saving a non-packable item on the evaluate page:
- Show success toast for 2.8 seconds
- Auto-reset to camera (no box assignment prompt)

#### AC-12: Packable items with no boxes
After saving a packable (non-oversized, non-NON_PACKABLE) item:
- If compatible open boxes exist: show box selector dropdown
- If no compatible open boxes exist: auto-reset to camera after 2.8 seconds

#### AC-13: Closed box access
In the Log detail overlay, closed boxes that match the destination are shown in a separate "Closed boxes" optgroup. Users can reassign items to closed boxes if needed.

#### AC-14: Box destination immutability
When creating a box in Bins, the destination is set and cannot be changed afterward. This ensures all items in a box share the same destination.

#### AC-15: Client-side enforcement only
Destination compatibility is enforced in the UI (box selectors are filtered). There is no server-side validation on the `box_id` update — the database accepts any valid box ID. The integrity depends on the client-side filtering.

## Data Model

### Existing fields used

| Table | Field | Type | Notes |
|-------|-------|------|-------|
| `cernita_entries` | `oversized` | boolean | Default false. Set by AI. |
| `cernita_entries` | `final_decision` | text | Determines compatibility rules |
| `cernita_entries` | `box_id` | int FK | Which box the item is in (null = unboxed) |
| `cernita_boxes` | `destination` | text | The decision this box is for (e.g., 'SHIP-ITALY') |
| `cernita_boxes` | `box_type` | text | 'plastic' or 'suitcase' |
| `cernita_boxes` | `closed_at` | timestamptz | Null = open, set = sealed |

### Migration
`docs/migration-011-oversized.sql`:
```sql
ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS oversized boolean NOT NULL DEFAULT false;
```

## UI States

### Evaluate page — post-save flow

```
Item saved
    │
    ├── Is NON_PACKABLE? ──yes──→ Toast 2.8s → Camera
    │
    ├── Is oversized? ──yes──→ "◱ Ships separately" + [Continue] button
    │
    ├── Has compatible open boxes? ──no──→ Toast 2.8s → Camera
    │
    └── Has compatible open boxes? ──yes──→ Box selector dropdown
                                            [Skip] [Pack it]
```

### Log detail overlay — box section

```
Item detail
    │
    ├── Is oversized? ──yes──→ "◱ Ships separately" (no selector)
    │
    ├── Is NON_PACKABLE? ──yes──→ "Being sold — not packed" (no selector)
    │
    └── Otherwise → Box selector (filtered by getCompatibleBoxes)
                     ├── Open plastic boxes (matching destination)
                     ├── Open suitcases (if GIVE-FAMILY)
                     └── Closed boxes (matching destination, separate group)
```

## Edge Cases

- **Decision override changes compatibility**: If a user overrides from SHIP-ITALY to SELL in the Log detail overlay, the box selector disappears and any existing `box_id` remains. The item should be manually unboxed.
- **NEEDS-HUMAN flexibility**: NEEDS-HUMAN items can go in any box because their final destination is unknown. Once resolved (decision changed), the box assignment may become invalid.
- **No boxes created yet**: If no boxes exist at all, the box section still renders but shows "No compatible boxes open — add one in Bins".
- **Suitcase for non-GIVE-FAMILY**: Suitcases only appear in the box selector for GIVE-FAMILY items. Other decisions can't pack into suitcases.
- **Oversized + non-packable**: If an oversized item is also SELL (e.g., user overrides), the oversized check takes precedence in rendering (checked first in the ternary chain).

## Out of Scope

- Server-side destination enforcement (constraint or trigger)
- Automatic unboxing when decision changes
- Oversized item shipping cost estimation (different from standard per-lb/cuft rates)
- Custom box dimensions (all boxes are assumed 27-gallon standard)
- Weight-based box capacity limits (exists for suitcases via `weight_limit_lb`, not for plastic boxes beyond soft/hard thresholds)

## Key Files

- `pages/evaluate.tsx` — `NON_PACKABLE`, `getCompatibleBoxes()`, post-save flow logic, oversized UI
- `pages/log.tsx` — `NON_PACKABLE`, `getCompatibleBoxes()`, `getCompatibleClosedBoxes()`, DetailOverlay box section
- `pages/bins.tsx` — box creation with destination selection
- `pages/api/anthropic.ts` — AI prompt with oversized definition and examples
- `lib/types.ts` — `oversized` field on Entry, `RuleField` inclusion
- `docs/migration-011-oversized.sql` — adds column
- `styles/globals.css` — `.badge-oversized`, `.oversized-note` classes
