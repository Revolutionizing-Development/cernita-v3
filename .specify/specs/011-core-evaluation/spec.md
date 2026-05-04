# Core item evaluation

> The primary function of Cernita. The user points their camera at an object (or describes it), the AI runs honest economic math, and a decision card appears. The user confirms or overrides. The entry saves.

| | |
|---|---|
| **Status** | draft |
| **Tier** | 4 (foundational — defines the canonical data schema and the primary user workflow) |
| **Branch** | `feat/core-evaluation` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-05-03 |
| **Last updated** | 2026-05-03 |
| **Constitution principles** | Principle 1 (user owns decision); Principle 2 (honest math); Principle 3 (data belongs to user); Principle 5 (decisions versioned); Principle 9 (safety); Principle 11 (bilingual); Principle 13 (preservation) |
| **Supersedes** | The evaluation flow from the v1.x single-file app |
| **Depends on** | Spec 009 (authentication); Spec 010 (stack and architecture) |

---

## Problem

This is the primary function of the app. Without a canonical schema and evaluation flow, every other spec builds on shifting ground. This spec defines what a `cernita_entries` row looks like, what the seven decision types mean, how the AI prompt works, and what the result card shows.

## User story

> I open Cernita and I'm on the Evaluate tab. I see a camera preview. I point it at the cast iron pan on the counter and tap "Evaluate." The AI asks about dimensions and weight; I answer or skip. Thirty seconds later: KEEP-ITALY · Porta in Italia | $47 net cost vs $120 replace. The math is visible. I confirm. Both phones update. Done.
>
> Six weeks later I update the storage rate. The AI re-derives. The pan now shows SELL. I see the old decision grayed out with an "Updated" badge. I accept or override and explain why. My override sticks through all future re-derivations.

## Decision types

| Code | English | Italian | Meaning |
|---|---|---|---|
| `KEEP-ITALY` | Keep — ship to Italy | *Porta in Italia* | Ships in ocean container |
| `KEEP-TEXAS` | Keep — move to Texas | *Porta in Texas* | Drives to Texas, stays |
| `SELL` | Sell | *Vendi* | Sold before the move |
| `DONATE` | Donate | *Dona* | Given away locally |
| `DISPOSE` | Dispose | *Smaltisci* | Trash, recycling, or hazmat |
| `GIVE-FAMILY` | Give to family | *Dai alla famiglia* | Goes to family via trip or suitcase |
| `NEEDS-HUMAN` | Needs discussion | *Richiede discussione* | No AI decision; both partners must align |

## Acceptance criteria

### Schema

- [ ] **AC1** The `cernita_entries` table is the canonical record for every evaluated item. Schema:

```sql
CREATE TABLE cernita_entries (
  id bigserial PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Identity
  user_name text NOT NULL,
  item_name text NOT NULL,
  item_name_it text,

  -- Decision
  final_decision text NOT NULL
    CHECK (final_decision IN (
      'KEEP-ITALY','KEEP-TEXAS','SELL','DONATE','DISPOSE','GIVE-FAMILY','NEEDS-HUMAN'
    )),
  user_confirmed boolean DEFAULT false,
  override_reason text,

  -- Economics
  estimated_resale_value numeric,
  replacement_cost numeric,
  weight_lb numeric,
  volume_cuft numeric,
  storage_cost_total numeric,
  ship_cost numeric,
  carry_bag_cost numeric,
  net_cost_ship numeric,
  net_cost_storage numeric,

  -- Rationale
  recommendation_rationale text,
  recommendation_rationale_it text,
  confidence text CHECK (confidence IN ('high','medium','low')),

  -- Rule versioning (Principle 5)
  rules_version text,
  rules_snapshot jsonb,

  -- Preservation (Principle 13)
  fragility text CHECK (fragility IN ('none','low','medium','high','irreplaceable')),
  survival_risk text,
  survival_risk_it text,
  packing_notes text,
  packing_notes_it text,

  -- Photo
  photo_data text,

  -- Bin grouping (destination concept — coexists with box_id)
  bin_id text,

  -- Physical location (added when spec 006 ships; nullable until then)
  box_id bigint,
  current_location_id bigint
);

CREATE INDEX idx_entries_created ON cernita_entries (created_at DESC);

-- RLS per spec 009
ALTER TABLE cernita_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON cernita_entries
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
```

The FK constraints on `box_id` and `current_location_id` are added when spec 006 ships. They are nullable in this spec.

- [ ] **AC2** `updated_at` is maintained by a `BEFORE UPDATE` trigger:

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER entries_updated_at
  BEFORE UPDATE ON cernita_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Evaluate tab

- [ ] **AC3** The Evaluate tab opens with a rear-camera preview centered on screen (`getUserMedia({ video: { facingMode: 'environment' } })`). A "Describe instead" text-input fallback is visible below the preview and becomes the primary input when camera permission is denied.

- [ ] **AC4** Tapping "Evaluate" captures the frame (or submits the text description), compresses the image to JPEG ≤200KB via `<canvas>`, and sends to `/api/anthropic` along with the current rules snapshot.

- [ ] **AC5** While the API call is in flight, the camera preview is replaced with a styled "thinking" animation — not a generic browser spinner. The user can cancel the in-flight request.

- [ ] **AC6** The API response populates a result card. The result card shows:
  - Item name: `[English name]` · *[Italian name in italic]*
  - Decision badge: e.g. `KEEP ITALY · Porta in Italia`
  - Economics table: net cost comparison (ship vs storage vs sell), all numbers visible — not collapsed
  - Confidence pill: high / medium / low with the Italian subline
  - Rationale paragraph (English), followed by italic Italian rationale
  - Preservation block (if fragility is not 'none'): fragility level, survival risk, packing notes — both languages

- [ ] **AC7** Two primary actions: **Confirm** saves with `user_confirmed = true`. **Override** opens an overlay where the user picks a decision type (dropdown, bilingual labels) and optionally explains why. Both actions save the full entry including the rules snapshot.

- [ ] **AC8** After saving, a brief toast shows the item name with "Saved · Salvato." The Log tab badge increments with a count-up animation. The Evaluate tab resets to camera-ready.

### Economics model

- [ ] **AC9** The `/api/anthropic` route constructs the AI prompt with the current rules from the app's settings:

```
Rules in effect:
- Storage: $[rate] / cu ft / month for [months] months
- Ocean shipping: $[rate_per_lb] / lb + $[rate_per_cuft] / cu ft
- Carry-on: free (no additional cost)

For this item, compute:
  net_cost_ship = ship_cost - estimated_resale_value
  net_cost_storage = storage_cost_total - estimated_resale_value
  sell_value = estimated_resale_value

Recommend the scenario with the best net outcome, adjusted for
survival risk and sentimental value signals visible in the photo/description.
```

- [ ] **AC10** The AI response is a structured JSON object containing all fields in the `cernita_entries` schema. The API route validates the structure before returning it to the frontend. On validation failure, it returns a partial result with `confidence = 'low'` and `final_decision = 'NEEDS-HUMAN'`.

- [ ] **AC11** Estimated values (resale, replacement) are labeled "est." in the UI. User-provided measurements (weight, dimensions) are labeled with a checkmark. The distinction is visual and present on the result card.

### Rule versioning (Principle 5)

- [ ] **AC12** Each saved entry stores `rules_version` (semver string, e.g. `"1.0.0"`) and `rules_snapshot` (the exact rules object at save time: storage rate, shipping rate, months in storage, date set). These are never updated after save — they are an immutable record of the assumptions used.

- [ ] **AC13** When the user changes a rule in Settings, the app shows outdated entries in the Log with a subtle "⟳ Outdated" badge. A "Re-derive all" button runs the economics formula locally against the new rules — no AI call needed. The AI is re-called only if the user explicitly requests a full re-evaluation.

- [ ] **AC14** Re-derivation never silently changes an entry with `override_reason` set. Instead, the user sees a diff overlay: "New rules would change this to SELL. Your override was: [reason]. Keep override or accept new decision?" Two buttons: keep / accept.

### User attribution

- [ ] **AC15** `user_name` is populated at save time from the authenticated user's `user_metadata.display_name`. It is not user-entered, not a Settings field.

## UI states

### State A — Camera ready

Camera preview (full bleed within the tab area). "Evaluate" button (terracotta, prominent). "Describe instead" text link below. No chrome, no labels — camera is the interface.

### State B — Thinking

Animated illustration or styled loading state — Cormorant Garamond ornament cycling. Item name field appears pre-filled with the AI's tentative guess (editable). Cancel link.

### State C — Result card

Slides up from bottom or replaces preview. Full-height card. Decision badge (large, color-coded by decision type). Economics table. Rationale in both languages. Preservation block if applicable. [Confirm] and [Override] at the bottom, with equal visual weight. "Edit before saving" link for adjusting any field.

### State D — Override overlay

Decision dropdown (7 options, bilingual). Override reason text area (placeholder: "Why are you overriding? (optional)"). [Cancel] and [Save override] buttons.

### State E — Saved confirmation

Brief toast at top: "Cast iron pan · Padella in ghisa — saved." Log badge count-up. Card slides away. Evaluate tab resets.

### State F — Camera permission denied

Fallback view: "Describe the item to evaluate it." Text area. "Evaluate" button. Same flow as camera evaluate, minus photo.

### State G — API error

Error toast: "AI unavailable — try again." Entry is NOT saved. The result card clears. No partial saves.

## Edge cases

- **EC1** Camera permission denied → text fallback shown, no crash, full evaluation still possible.
- **EC2** API call times out (>30s) → error toast, no save.
- **EC3** User submits with no photo and no description → form validation: "Describe the item to continue."
- **EC4** AI returns a `final_decision` not in the valid set → default to `NEEDS-HUMAN`, log the anomaly server-side.
- **EC5** `box_id` FK referenced before spec 006 ships → column is nullable, saves as NULL, no error.
- **EC6** Two evaluations submitted simultaneously from two phones → both save independently. No deduplication. The Log shows both; users reconcile in the Discuss tab.
- **EC7** Very long item name returned by AI → truncate display to 60 chars in the badge; full name shown in card body.
- **EC8** AI returns `confidence = null` → render as "medium" in the UI; don't crash.

## Out of scope

- Bulk evaluation (multiple items in one AI call)
- Barcode / QR code scanning for automatic price lookup
- Item categories or taxonomy
- Cost comparison with live third-party shipping APIs
- Re-evaluation via AI on rule change (re-derivation uses local math only)
- Editing item name or fields after save (addressed in a future Log editing spec)

## References

- Constitution Principles 1, 2, 3, 5, 9, 11, 13
- Spec 009 (authentication — session, user attribution)
- Spec 010 (stack — API routes, photo compression, React Context)
- Spec 006 / Spec 007 (location tracking, trips — `box_id` and `current_location_id` FKs added when those ship)
- Anthropic API documentation (claude-3-5-sonnet or claude-opus-4 for evaluation)
