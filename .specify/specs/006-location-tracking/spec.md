# Physical location tracking

> Track where every box and large item physically is right now — at the source home, in transit, in storage, at the destination. Box numbers separate from destination groupings. Weight discipline built into the box assignment flow.

| | |
|---|---|
| **Status** | draft |
| **Tier** | 3 (substantial — new entity in schema, new UI views, weight logic, bulk operations) |
| **Branch** | `feat/location-tracking` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-04-27 |
| **Last updated** | 2026-04-27 |
| **Constitution principles** | Principle 1 (user owns the decision); Principle 2 (honest math — weight tracking is honest physics); Principle 4 (two people, one truth — both partners see real-time location); Principle 9 (safety — weight overload causes real damage); Principle 11 (bilingual — locations have Italian names); Principle 12 (compliance — ocean freight has real weight limits) |
| **Supersedes** | none |
| **Depends on** | bilingual item names (shipped); bilingual rationale (shipped); rule versioning system (shipped) |

---

## Problem

Cernita today knows where each item is supposed to go (`bin_id` represents destination grouping like KI-04, KT-A). It doesn't know **where each item physically is right now**.

This becomes acute as the move progresses:

1. **During packing.** "Did I already pack the cast iron skillet, or is it still in the kitchen drawer?" The user has no answer.

2. **At pickup.** The moving truck arrives. The user has 47 boxes. Some are going to Texas, some to storage, some staying in Galesburg until the next trip. Without location tracking, every box has to be visually inspected to confirm where it should go.

3. **In transit.** Weeks pass. "Did the rower make it on the truck or is it still in storage?" Without tracking, the user is guessing.

4. **At the destination.** Boxes arrive in Italy. Some are missing. Insurance claim time. Without records of "this item was in BOX-019 which was on shipment X," recovery is hard.

5. **Weight overload during packing.** A box gets packed beyond what's safe to lift (or in some cases beyond shipping limits). Without a running weight total per box, the user can't know until they try to lift it. By then it's too late — backs hurt, items shift unsafely.

The current `bin_id` doesn't solve these. It's a destination concept, not a location concept. We need both.

## Why now

Three reasons this is the right next major feature:

1. **The user requested it explicitly.** Direct request, not a guess.

2. **The cost of waiting compounds.** Every item evaluated and packed without location tracking is one more item that has to be retroactively located when this ships. With ~500 items expected, retrofitting becomes painful.

3. **The Bins tab is going to change anyway.** When this ships, the Bins tab gains a new "By location" view. If we ship search separately first, we'd revisit the search UI to make it work across both bins and boxes. Better to ship location first, then layer search on top of the unified UI.

## User story

> As one of the two people doing this move, when I scan or save an item, I want to (optionally) say "this is going into BOX-007" — and BOX-007 has a current location like "Galesburg garage". Later, when I move BOX-007 to the moving truck, I update its location once and every item inside it updates with it.
>
> When I tap into a box and try to add an item to it, I want the app to tell me "this item is destined for SELL but BOX-007 is destined for KEEP-ITALY — pick one to fix." I don't want to discover the mismatch when the box arrives at the wrong place.
>
> As I add items to a box, I want to see the running weight. When the total approaches 50 pounds, I want a warning. When it crosses 70 pounds (typical airline checked-bag limit), the app should make the consequence loud.
>
> For large items that don't fit in a box — the rower, the dresser, the bike — they get tracked individually. Each has its own current location, updated independently.
>
> As I pack, I want to physically write "BOX-007" on the cardboard box (eventually with a printable label, separate spec) and trust that the digital record matches. The box numbers should be sequential and easy to read.

## Acceptance criteria

### Schema and data model

- [ ] **AC1** A new `cernita_boxes` table is created in Supabase, with columns: `id`, `box_number` (e.g., "BOX-007"), `household_id`, `destination` (KEEP-ITALY, etc.), `current_location_id`, `notes`, `notes_it`, `created_at`, `closed_at` (nullable; set when the box is sealed/marked done).
- [ ] **AC2** `cernita_entries` gains a `box_id` column (nullable foreign key to `cernita_boxes.id`). An item with `box_id = null` is "unboxed" — either a large individually-tracked item or a not-yet-packed item.
- [ ] **AC3** `cernita_entries` gains a `current_location_id` column (used only when `box_id` is null — for large items individually tracked).
- [ ] **AC4** A new `cernita_locations` table stores location values, with columns: `id`, `household_id`, `name`, `name_it`, `is_default`, `sort_order`. Default locations are seeded on first use of the feature: Galesburg house, Galesburg storage, Texas rental, In transit, Italy port, Italy house, Sold, Donated, Disposed.

### Box management UI

- [ ] **AC5** The Bins tab gains a toggle at the top: "By destination" (current) and "By location" (new). The toggle persists in component state during the session.
- [ ] **AC6** "By destination" view is unchanged from the current Bins tab — items grouped by `bin_id`.
- [ ] **AC7** "By location" view groups boxes (and unboxed large items) by current location. Each location section shows: location name (English + Italian italic subline), total box count, total weight, list of boxes inside.
- [ ] **AC8** A "+ New box" action creates a new box: auto-assigns the next sequential `box_number` (BOX-001, BOX-002, …), prompts for destination from the existing destination set, sets `current_location` to a sensible default (the user's most recently used location, or "Galesburg house" on first use).
- [ ] **AC9** A box card shows: box number, destination, current location, item count, running weight (with visual indicator for safe / borderline / over), assigned items, "+ Add item" and "Move to location" actions.
- [ ] **AC10** Moving a box to a new location updates all items inside it implicitly (no per-item update needed). Bulk operation: select multiple boxes → "Move to location" → pick → confirm.

### Item-to-box assignment

- [ ] **AC11** When saving a new item from the Evaluate flow, after the decision is made, the user sees a "Pack into box" prompt with a dropdown of compatible boxes (matching destination) plus a "+ New box" option. They can also skip ("pack later"), in which case the item saves with `box_id = null`.
- [ ] **AC12** When assigning an item to a box from the Detail overlay, the dropdown shows only boxes whose destination matches the item's destination. Boxes with mismatched destination appear in a separate "incompatible — would block" group, disabled.
- [ ] **AC13** If the user manually attempts to assign to an incompatible box, the save is hard-blocked with a clear error: "Item destination is SELL but BOX-007 is KEEP-ITALY. Pick one to update." Two buttons: "Update item destination" (changes the item) and "Update box destination" (changes the box, but only if the box has 0 other items — otherwise warn that it would conflict with existing items).
- [ ] **AC14** When a box has items in it AND its destination would change, all current items must match the new destination. If any don't, show an error listing them and prevent the change until resolved.

### Large items (individually tracked)

- [ ] **AC15** When saving a new item, if the item is large (volume > 4 cu ft OR weight > 50 lb — heuristic, configurable threshold), the "Pack into box" prompt is replaced with "Track individually" — the user picks a current location from the list and saves. `box_id` stays null.
- [ ] **AC16** The user can manually toggle any item between "in a box" and "tracked individually" from the Detail overlay.
- [ ] **AC17** Large items appear in the "By location" view as a separate section under each location: "Items not in boxes."

### Locations management (Settings)

- [ ] **AC18** Settings gains a new "Locations" subsection in the Maintenance area. Lists all locations with English name, Italian name, and an indicator of whether each is in use (count of boxes/items currently there).
- [ ] **AC19** Users can add custom locations (English name + Italian name). Inline form, saves to database.
- [ ] **AC20** Users can edit existing locations (rename, change Italian translation). Default locations have their Italian names pre-seeded but are editable.
- [ ] **AC21** Users can delete a location only if no boxes or items reference it. Otherwise the delete button shows: "N boxes/items here — move them first."
- [ ] **AC22** Locations have a `sort_order` field controlling display order in dropdowns and views. Default locations are pre-sorted in expected geographic flow (origin → transit → destination).

### Weight discipline

- [ ] **AC23** Each box card prominently displays its running weight. Visual treatment: green/safe (≤30 lb), olive/normal (30–50 lb), gold/heavy (50–65 lb), terracotta/borderline (65–70 lb), terracotta-bold/over-limit (>70 lb).
- [ ] **AC24** When adding an item to a box that would push the box over 50 lb, the "+ Add item" confirmation shows the projected new weight with the visual indicator.
- [ ] **AC25** When the projected weight exceeds 70 lb (airline checked-bag standard limit), a warning is shown and confirmation is required: "This box would weigh 73 lb — over the standard 70 lb checked-bag limit. Continue anyway?"
- [ ] **AC26** Settings gains a "Weight limits" subsection in the same area as Locations. Lets the user override the soft warning threshold (default 50 lb) and the hard warning threshold (default 70 lb). Italian name: "Limiti di peso."
- [ ] **AC27** Boxes destined for ocean freight (KEEP-ITALY) do not have hard upper limits per box (LCL ocean freight charges by volume, not weight, with rare density-limit exceptions). The warning is only about safe lifting, not freight cost. Tooltip explains this so the user understands the warning is ergonomic, not financial.

### Bilingual

- [ ] **AC28** All location names are bilingual (English + Italian). Default seeds use accurate Italian (Galesburg house → "Casa di Galesburg," In transit → "In transito," Italy port → "Porto italiano," Italy house → "Casa in Italia," etc.).
- [ ] **AC29** Box numbers (BOX-001) are universal — not translated. Sequential numbering only.
- [ ] **AC30** Box notes field has both `notes` and `notes_it` columns. Notes are user-written, so bilingual is optional per box.

## Data model changes

```sql
-- Migration 2f: physical location tracking
-- Adds boxes table, locations table, plus columns on entries.

create table if not exists cernita_locations (
  id bigserial primary key,
  household_id text not null,
  name text not null,
  name_it text,
  is_default boolean default false,
  sort_order integer default 100,
  created_at timestamptz default now()
);
create index if not exists idx_cernita_locations_household
  on cernita_locations (household_id, sort_order);

create table if not exists cernita_boxes (
  id bigserial primary key,
  household_id text not null,
  box_number text not null,
  destination text not null,
  current_location_id bigint references cernita_locations(id),
  notes text,
  notes_it text,
  closed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_cernita_boxes_household_loc
  on cernita_boxes (household_id, current_location_id);
create unique index if not exists idx_cernita_boxes_household_number
  on cernita_boxes (household_id, box_number);

alter table cernita_entries
  add column if not exists box_id bigint references cernita_boxes(id),
  add column if not exists current_location_id bigint references cernita_locations(id);

create index if not exists idx_cernita_entries_box
  on cernita_entries (household_id, box_id);

alter table cernita_locations enable row level security;
alter table cernita_boxes enable row level security;

create policy "anon read" on cernita_locations for select using (true);
create policy "anon insert" on cernita_locations for insert with check (true);
create policy "anon update" on cernita_locations for update using (true);
create policy "anon delete" on cernita_locations for delete using (true);

create policy "anon read" on cernita_boxes for select using (true);
create policy "anon insert" on cernita_boxes for insert with check (true);
create policy "anon update" on cernita_boxes for update using (true);
create policy "anon delete" on cernita_boxes for delete using (true);
```

The existing `bin_id` column stays untouched. It continues to represent destination grouping. The new `box_id` is for physical tracking. They coexist.

## UI states

### State A — Bins tab, "By destination" view (unchanged)
Current behavior. Items grouped by `bin_id` with savings card, unit recommender, etc. Toggle at top: ⚭ By destination / ⚒ By location.

### State B — Bins tab, "By location" view
Toggle to "By location." The savings card and unit recommender still appear at top. Below, sections grouped by current location, each with: location name (English + Italian italic), summary (N boxes, total weight), and box cards.

### State C — Box detail (expanded view)
Modal overlay similar to Detail overlay. Shows: box number, destination, current location (editable), bilingual notes field, weight gauge (large, prominent), list of items inside, "+ Add item" button, "Move to location" button, "Mark closed" / "Reopen" toggle, "Delete box" with confirmation (only if empty).

### State D — Adding an item to a box (compatibility check)
Picker shows "Items destined KEEP-ITALY (compatible)" first with [+] buttons, then "Items with other destinations (would block)" group, disabled. Tapping a "would block" item opens resolution dialog (state E).

### State E — Destination mismatch resolution
Modal with two radio options: "Change item's destination" or "Change box's destination" (latter only enabled if box has 0 conflicting items). Cancel and Apply buttons.

### State F — Weight warning during item addition
Visual gauge showing projected weight, threshold position. Warning text explaining lifting safety, carrier surcharges, and box failure risk. Three buttons: Cancel, Pack in different box, Continue.

### State G — Settings → Locations subsection
Inside Maintenance section. Lists locations with usage counts in parentheses. Inline editor on tap. "+ Add location" button at bottom.

### State H — Settings → Weight limits subsection
Two number inputs (soft and hard thresholds). Note explaining these are about safe lifting and box durability, not freight cost.

### State I — Bulk move (multi-box selection)
Long-press or "Select multiple" mode shows checkboxes on each box. "Move N boxes to location..." button at bottom. Picker shows location list. Confirm. All selected boxes update.

### State J — Empty state, "By location" view, no boxes yet
Friendly empty state: "No boxes yet. Create a box to start tracking where things physically are." [+ New box] button.

## Edge cases

- **EC1** User creates BOX-001, BOX-002, then deletes BOX-001. Next box created is BOX-003 (not reusing BOX-001's number). Avoids confusion when re-adding items to a "phantom" box number.

- **EC2** Two users simultaneously create boxes from different phones. Auto-numbering must not collide. Use Postgres select-max-then-insert with conflict retry.

- **EC3** User assigns an item to a box, then changes the item's `final_decision` to one that no longer matches the box. → Hard block per AC13.

- **EC4** User changes a box's destination while it has items. → Per AC14, only allowed if all items in the box match the new destination.

- **EC5** User deletes a location that's currently in use. → AC21: blocked, with count of usage shown.

- **EC6** Item weight is null/unknown. → Allow it. Box weight uses available data plus a "1 unknown weight" indicator.

- **EC7** Box has only items with null weights. → Display "weight unknown — N items." Don't block packing.

- **EC8** A box already over the hard threshold gets the user trying to add another item. → AC25 warning, but allow override.

- **EC9** User on old version of app loads new entry with `box_id`. → New columns ignored by old code, no error.

- **EC10** Migration not run, but app updated. → Save attempts include `box_id`, Postgres rejects column. App falls back to saving without it, toasts: "Run SQL migration 2f in Settings."

- **EC11** Large item rule (volume > 4 ft³ OR weight > 50 lb) is heuristic. → Make the suggestion soft: "This looks large — track individually?" with both options offered.

- **EC12** User wants to track an item individually that's already in a box. → Detail overlay's "Move out of box" button. Sets `box_id = null`, prompts for `current_location_id`.

- **EC13** "By location" view is empty because no boxes have been created yet but items exist with `bin_id`. → Show explanatory empty state. Don't auto-create boxes from existing `bin_id`.

- **EC14** Box and item current_location ever conflict. → Should be impossible by data model: if `box_id` is set, item's location is derived from box. Item-level `current_location_id` only used when `box_id is null`.

- **EC15** Both partners change the same box's location simultaneously. → Last-write-wins on Supabase. Accept the conflict.

- **EC16** Bilingual location names: user adds custom location with English only. → Save with `name_it = null`. Display falls back to English alone.

- **EC17** Weight unit confusion (lb vs kg). → All weights in pounds (existing convention). Settings clarifies. Future spec could add unit toggle.

- **EC18** Bulk move of 50 boxes triggers 50 database updates. → Acceptable, Supabase handles fine. No batching needed for v1.

## Out of scope

- **QR code generation for boxes.** Separate Tier 2 spec.
- **Box content photos.** Out of scope; per-item photos already captured.
- **Timeline / location history.** Track current only, not history. Future spec.
- **Auto-detecting location via GPS.** Not v1.
- **Location-based filtering in the Log view.** Bins tab "By location" view handles this.
- **Insurance valuation per box.** Will be addressed in insurance manifest spec.
- **Volume tracking per box.** Volume tracked at item level for storage sizing.
- **Different box sizes / box types.** All boxes treated uniformly.
- **Box sealing/integrity workflow.** "Mark closed" exists but doesn't trigger anything beyond timestamp.
- **Multiple destinations per box (mixed-destination shipping).** Hard-blocked per AC13.
- **Box-level photos at packing.** Future polish.
- **Custom box numbering schemes (BOX-KI-007).** Sequential simple numbers only.

## Open questions

- **Q1:** Should the "By location" view also show Sold/Donated/Disposed locations?
  **A:** Show them with lower visual weight. Useful for confirming what was sold/donated.

- **Q2:** When a user changes a box's destination, should we also update `bin_id` on its items?
  **A:** No. `bin_id` is more granular. Items keep their `bin_id`; it's just guaranteed to match the box's destination category.

- **Q3:** Box numbers globally sequential or per-destination?
  **A:** Globally sequential per the user's answer. Easier to verbally reference.

- **Q4:** When item destination changes via re-derivation and it's in an incompatible box, what happens?
  **A:** Block re-derivation of that item with the same resolution prompt as State E.

- **Q5:** Do large items (tracked individually) appear in "By destination" view?
  **A:** Yes — as their own row, with a visual indicator.

- **Q6:** Items with `final_decision = NEEDS-HUMAN` — can they be put in a box?
  **A:** No. Detail overlay shows: "Resolve decision before packing."

- **Q7:** Should the location dropdown remember the last-used location per session?
  **A:** Yes. If user just packed BOX-001 with "Galesburg garage," BOX-002's default suggestion is also "Galesburg garage." Persisted to component state, not localStorage.

- **Q8:** What happens to `bin_id` once boxes exist?
  **A:** `bin_id` stays. Represents destination grouping (KI-04 = Keep-Italy box 4) and is independent of physical box. The two coexist.

All open questions resolved.

## References

- **Constitution Principles 1, 2, 4, 9, 11, 12** — multiple touched
- **Spec dependencies:** bilingual item names, bilingual rationale, rule versioning (all shipped)
- **Ocean LCL freight:** pricing by volume, not weight, with rare density limits. ExFreight, iContainers, Freightos sources.
- **Airline checked-bag limit:** 70 lb (32 kg) standard for international flights.
- **Safe-lifting threshold:** ~50 lb is generally cited as max safe single-person lift; OSHA recommends two-person lifts above this.

## Implementation notes

### Sequencing

This Tier 3 spec ships in three commits:

1. `feat(schema): location-tracking schema, migrations, default location seeding` — pure data model + seeding logic, no UI changes.
2. `feat(boxes): box CRUD, item-to-box assignment, weight tracking` — backend logic and Detail overlay's box assignment UI.
3. `feat(ui): "By location" view, bulk move, locations management in Settings` — larger UI changes.

### Default locations seed

Seeded automatically the first time the user opens Locations management UI or first creates a box. Detection: `select count(*) from cernita_locations where household_id = ?` returns 0 → seed. Idempotent.

### Box numbering function

```javascript
async function nextBoxNumber(householdId) {
  // Select existing box_numbers for household, parse "BOX-NNN", find max, increment
  // Return zero-padded "BOX-NNN+1"
}
```

### Compatibility check

```javascript
function canAssignToBox(item, box) {
  return item.final_decision === box.destination;
}
```

Used to filter the box dropdown (compatible only) and to validate before save.

### Location inheritance

```javascript
function itemCurrentLocationId(item) {
  if (item.box_id) {
    const box = state.boxes.find(b => b.id === item.box_id);
    return box ? box.current_location_id : null;
  }
  return item.current_location_id;
}
```

Always go through this helper.

### State management

Add to global state:
- `state.boxes` — array of box records
- `state.locations` — array of location records
- `state.binsViewMode` — "destination" | "location" (session-only)
- `state.lastUsedLocationId` — for "remember last location" UX (session-only)

### CSS additions

- Weight bar gradient (olive → gold → terracotta as weight rises)
- Box card with stronger left border and box number in monospace font
- Location section header (italic Cormorant Garamond name + italic ink-soft Italian + horizontal rule)

### Migration approach

Migration 2f added as discrete step in Settings, alongside existing 2b/2d/2e blocks. Cumulative migration block 2b also extended.
