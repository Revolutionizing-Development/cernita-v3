# Trips and suitcases

> Real-world travel as a first-class concept. Trips have travelers, dates, routes, and one or more suitcases. Suitcases are a type of box with airline-specific weight limits. When a trip executes, the items inside its suitcases move to the destination location and the manifest becomes a permanent record.

| | |
|---|---|
| **Status** | draft |
| **Tier** | 3 (substantial — new entity, extends box concept, weight discipline, execution workflow, immutable history) |
| **Branch** | `feat/trips-suitcases` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-04-27 |
| **Last updated** | 2026-04-27 |
| **Constitution principles** | Principle 1 (user owns the decision); Principle 2 (honest math — airline limits are real); Principle 4 (two people, one truth — both partners see trip plans); Principle 5 (decisions are versioned, not frozen — but executed trips ARE frozen by design); Principle 9 (safety — airline overweight surcharges are real); Principle 11 (bilingual — trips have Italian labels); Principle 12 (compliance — different airlines have different allowances) |
| **Supersedes** | none |
| **Depends on** | `/specs/location-tracking.md` (must ship first — trips operate on boxes/items that have a location); bilingual item names (shipped); bilingual rationale (shipped) |

---

## Problem

Cernita's existing model assumes one big move: stuff in Galesburg → stuff in Texas → stuff in Italy. Reality is messier. Real moves are punctuated by trips:

- A two-week visit to Doetinchem in June, with checked bags carrying photos and books for family safekeeping
- A holiday trip to Mexico in August where the wife brings curated gifts to her parents
- A scouting trip to Italy in October where a few small high-value items pre-position to the future house
- Eventually, the move itself

Each of these is a real airline event with weight limits, traveler identity, and physical movement of stuff. The user needs to plan ("what will fit in the June trip?"), pack ("which items go in which bag?"), execute ("the trip happened, items are now there"), and remember ("six months later, what did we send to NL on the June trip?").

Today, none of this is in Cernita. The user does it in their head, on sticky notes, or in a spreadsheet. This spec brings it into the app.

Three concrete problems trip tracking solves:

1. **Suitcase weight overload.** Without the app showing running weight, the user packs until the bag is full, then weighs it at the airport, then has to unpack and pay $200 in overweight fees or leave items behind. With trip tracking, the app shows running weight as items are added and warns before the limit.

2. **Forgetting what went on which trip.** Six months later, the user can't remember whether the photo album was in the June bag or stayed in Galesburg. Insurance claim or customs question, no answer. With trip tracking, the manifest is a permanent record.

3. **Decision math without trips is wrong.** "Give to family NL" can't be priced honestly without knowing whether a trip is planned. If a trip is happening anyway, sending an item via that trip is essentially free. Without trips, the AI either undercounts costs (treats all family destinations as free, even if no trip) or overcounts (treats them all as ocean freight, even if a trip is imminent). With trips planned, the math becomes honest.

## Why now

Three reasons:

1. **Location tracking is shipping next.** Trips need locations to function. With locations as the foundation, trips become a natural extension. Doing them in the wrong order (trips before locations) would mean special-casing trip logic for items that have no location concept yet.

2. **The user explicitly named family destinations and trip-via-suitcase as core to their reality.** This isn't a polish feature; it's a missing primitive. Family destinations without trips are pretend destinations.

3. **Trips happen before the move.** The user has trips in their immediate calendar (next few months). If the app doesn't support trip planning by then, the trips happen outside the app and the data is lost. Building this now means the next family trip can use Cernita.

## User story

> As one of the two people doing this move, when I see a family trip coming up, I want to plan what goes in the suitcases. I open Cernita, create a trip ("June 2026 Doetinchem"), tell it who's traveling (me, my wife, or both), how many bags, and the airline's checked/carry-on limits.
>
> Then as I evaluate items in the weeks before the trip, I can mark "this is going on the June trip, into Marco's checked bag." The app keeps a running total of that bag's weight. When the bag hits 45 of its 50 lb limit, the app warns me. When I try to add another 8 lb item, it tells me the bag would be overweight and suggests another suitcase or to defer to a later trip.
>
> The day after we get back, I open the app and tap "Mark trip executed." All the items in those suitcases now show their current location as Doetinchem (or wherever they were delivered). The trip and its manifest are now in the past — locked, but searchable.
>
> Six months later when I'm doing customs paperwork, I can pull up the manifest from the June trip and prove what went where, when, with whom.

## Acceptance criteria

### Schema

- [ ] **AC1** A new `cernita_trips` table is created with columns: `id`, `household_id`, `name`, `name_it`, `traveler_name`, `origin_location_id`, `destination_location_id`, `departure_date`, `return_date` (nullable for one-way trips), `status` (planned / packing / executed / canceled), `executed_at`, `notes`, `notes_it`, `created_at`.

- [ ] **AC2** The existing `cernita_boxes` table (from location-tracking spec) gains four columns: `box_type` ('cardboard' | 'suitcase'), `trip_id` (nullable foreign key to `cernita_trips.id`), `suitcase_class` ('checked' | 'carry_on' | 'personal_item' — null for cardboard boxes), `weight_limit_lb` (nullable; numeric override of default thresholds for this specific box).

- [ ] **AC3** When `box_type = 'suitcase'`, the box must have a `trip_id` (not null) and a `suitcase_class` (not null). A check constraint enforces this at the database level.

- [ ] **AC4** The `weight_limit_lb` column is used as the hard threshold for suitcases (no soft/hard distinction — there's a single airline limit). For cardboard boxes, this column is null and the global thresholds (from settings) apply.

### Trip CRUD

- [ ] **AC5** A new "Trips" view is added to the app. Shown as either a top-level tab (mobile) or a sidebar entry (desktop), depending on screen size. Order: Evaluate, Log, Bins, Trips, Discuss, Settings.

- [ ] **AC6** The Trips view shows two sections: "Upcoming" (status = planned or packing) and "Past" (status = executed or canceled). Upcoming section is sorted by departure_date ascending; Past section is sorted by executed_at descending.

- [ ] **AC7** A "+ New trip" action opens a form: name (English + Italian), traveler name, origin location (dropdown from existing locations), destination location (dropdown), departure date, return date (optional), notes. Saves as status = planned.

- [ ] **AC8** A trip card shows: name, traveler, origin → destination, dates, total weight across all suitcases, summary status. Status pill is color-coded (planned = ink-soft, packing = gold, executed = olive, canceled = terracotta-soft).

- [ ] **AC9** Tapping a trip opens a detail view: trip header, list of suitcases, "+ Add suitcase" button, "Mark as packing" / "Mark as executed" / "Cancel trip" actions, list of all items across all suitcases, total weight summary.

### Suitcase management

- [ ] **AC10** Within a trip's detail view, "+ Add suitcase" creates a new box with `box_type = 'suitcase'`, prompts for class (checked / carry-on / personal item), weight limit (defaults from settings, editable), and optional name (e.g., "Marco's checked").

- [ ] **AC11** A suitcase appears in the trip detail showing: class label, weight limit, running weight, item count, list of items inside, "+ Add item" button.

- [ ] **AC12** Suitcases also appear in the Bins tab "By location" view (since they're boxes), under their current location. Visual distinction: suitcase icon and class label instead of cardboard-box icon.

- [ ] **AC13** When a trip is canceled or executed, its suitcases stay in the database. Executed suitcases get the trip's destination as their current location. Canceled suitcases keep their current location and are unassigned from the trip (`trip_id` set to null), reverting to plain cardboard boxes the user can repurpose.

### Item-to-suitcase assignment

- [ ] **AC14** When evaluating an item, after the decision is made, if there are upcoming trips compatible with the destination, the "Pack into box" prompt offers them: "Pack into BOX-007 (Galesburg house)" or "Pack into June 2026 NL trip > Marco's checked bag (12 of 50 lb used)." Compatibility check: trip's destination matches item's destination, or trip is a one-way to the item's destination.

- [ ] **AC15** Items can be assigned to a suitcase from the Detail overlay: a "Move to suitcase" option in addition to "Move to box". Same compatibility rules as AC14.

- [ ] **AC16** When adding an item to a suitcase, weight is checked against the suitcase's `weight_limit_lb`. If the addition would exceed the limit: hard-block with an error showing current weight, projected weight, limit, and three resolution options ("pack in different suitcase," "defer to later trip," "cancel").

- [ ] **AC17** When adding an item to a suitcase whose trip's destination doesn't match the item's destination, hard-block with the same resolution dialog as the box mismatch flow (from location-tracking spec): "Item destination is X, trip destination is Y, pick one to update."

### Trip execution workflow

- [ ] **AC18** On a trip's detail view, a "Mark as executed" button appears once at least one suitcase has been packed. Tapping opens a confirmation dialog: "Mark June 2026 NL trip as executed? All N items in M suitcases will move to current location: Doetinchem (family). This action can be reversed within 30 days." Confirm to execute.

- [ ] **AC19** Trip execution updates: trip's `status = 'executed'` and `executed_at = now()`. All suitcases assigned to the trip have their `current_location_id` set to the trip's `destination_location_id`. All items in those suitcases inherit the new location automatically (via the existing inheritance logic in location-tracking spec).

- [ ] **AC20** After execution, a trip is treated as immutable by default: trip metadata can't be edited, suitcases can't be added/removed, items can't be added/removed from suitcases. The trip detail view shows a small "🔒 Executed [date]. Reopen if needed." link.

- [ ] **AC21** Tapping "Reopen" on an executed trip prompts confirmation: "Reopen this executed trip? You'll be able to edit the manifest. Use this only to fix mistakes — items have already physically moved." Confirm to set status back to `packing`. The execution timestamp is preserved in `executed_at` for audit purposes.

- [ ] **AC22** Reopened trips can be re-executed. Each re-execution updates `executed_at` to the new time. The previous timestamp is not preserved (intentional simplification — no execution history).

- [ ] **AC23** A trip in `canceled` status is also locked (no further edits) but can be deleted entirely (unlike executed trips, which preserve as record).

### Settings

- [ ] **AC24** Settings → Maintenance gains a "Trip defaults" subsection with: default checked-bag weight limit (default 50 lb), default carry-on weight limit (default 22 lb), default personal-item weight limit (default 16 lb). These defaults are used when creating a new suitcase; per-suitcase override is always available.

- [ ] **AC25** A note in the Trip defaults subsection: "Different airlines and routes have different limits. These are sensible defaults for international economy. Always verify your specific airline's policy before relying on these."

### Bilingual

- [ ] **AC26** Trip names have both `name` and `name_it` fields. Italian name is optional; falls back to English name when null.

- [ ] **AC27** Status labels are bilingual: planned / pianificato, packing / in preparazione, executed / completato, canceled / annullato. The Italian appears as italic subline next to the English.

- [ ] **AC28** Suitcase class labels are bilingual: checked / da stiva, carry-on / a mano, personal item / oggetto personale.

- [ ] **AC29** All trip notes have both `notes` and `notes_it` columns, like box notes.

## Data model changes

```sql
-- Migration 2g: trips and suitcases
-- Adds trips table; extends boxes table with box_type, trip_id, suitcase_class, weight_limit_lb.

create table if not exists cernita_trips (
  id bigserial primary key,
  household_id text not null,
  name text not null,
  name_it text,
  traveler_name text not null,
  origin_location_id bigint references cernita_locations(id),
  destination_location_id bigint references cernita_locations(id),
  departure_date date,
  return_date date,
  status text not null default 'planned'
    check (status in ('planned','packing','executed','canceled')),
  executed_at timestamptz,
  notes text,
  notes_it text,
  created_at timestamptz default now()
);
create index if not exists idx_cernita_trips_household_status
  on cernita_trips (household_id, status, departure_date);

alter table cernita_boxes
  add column if not exists box_type text default 'cardboard'
    check (box_type in ('cardboard','suitcase')),
  add column if not exists trip_id bigint references cernita_trips(id),
  add column if not exists suitcase_class text
    check (suitcase_class is null or suitcase_class in ('checked','carry_on','personal_item')),
  add column if not exists weight_limit_lb numeric;

-- Suitcases must have a trip and a class
alter table cernita_boxes
  add constraint suitcase_requires_trip
    check (box_type != 'suitcase' or (trip_id is not null and suitcase_class is not null));

create index if not exists idx_cernita_boxes_trip
  on cernita_boxes (household_id, trip_id);

alter table cernita_trips enable row level security;
create policy "anon read" on cernita_trips for select using (true);
create policy "anon insert" on cernita_trips for insert with check (true);
create policy "anon update" on cernita_trips for update using (true);
create policy "anon delete" on cernita_trips for delete using (true);
```

The existing `cernita_boxes` table is extended, not replaced. Cardboard boxes (the existing concept) get `box_type = 'cardboard'` as default. Suitcases are a new variant with required `trip_id` and `suitcase_class`.

## UI states

### State A — Trips view, empty
First time the user visits Trips with no trips created. Friendly empty state: "No trips yet. Plan a trip to track items going via suitcase." [+ New trip] button prominent. Italian italic subline: "Nessun viaggio ancora pianificato."

### State B — Trips view, with trips
Two sections, "Upcoming" and "Past." Upcoming shows planned and packing trips, sorted by date. Past shows executed and canceled, most recent first. Each trip card shows name (with Italian italic subline), traveler, route, dates, total weight, status pill.

### State C — Trip detail view
Header: trip name (large), traveler, dates, route. Status section with current status and action buttons. Suitcases list (each suitcase shown as a card with weight gauge, item count). All items list (deduplicated across suitcases for the user's reference). Notes field (bilingual edit). For executed trips: a 🔒 banner with "Executed [date] · Reopen if needed."

### State D — Adding a suitcase to a trip
Form: class dropdown (Checked / Carry-on / Personal item), weight limit (numeric input pre-filled with default), optional custom name. Save creates a new box with the trip's id and the suitcase metadata.

### State E — Adding an item to a suitcase
Same flow as adding to a cardboard box, but with hard-limit weight enforcement (suitcase has fixed limit, no soft/hard distinction). If projected weight > limit, immediate block with resolution options.

### State F — Pack-into-trip prompt at evaluation time
After saving an item with a destination, the "Pack into box" prompt now includes upcoming trip suitcases as options. Layout:

```
Pack [item] somewhere?

Cardboard boxes (current location: Galesburg house)
  · BOX-007 (KEEP-ITALY) · 12 of ~50 lb
  · BOX-008 (KEEP-ITALY) · 8 of ~50 lb
  + New cardboard box

Upcoming trips
  · June 2026 NL → Marco's checked (KEEP-ITALY) · 12 of 50 lb
  · June 2026 NL → Marco's carry-on (KEEP-ITALY) · 4 of 22 lb
  · August 2026 Mexico → Elena's checked (GIVE-FAMILY-MX) · empty
  + New trip

Skip — pack later
```

### State G — Trip execution confirmation
Modal:
```
Mark "June 2026 NL trip" as executed?

This will:
- Move 23 items in 2 suitcases to "Doetinchem (family)"
- Lock the trip manifest as a record
- Set the execution date to today

You can reopen the trip within 30 days if needed.

[Cancel]  [Mark executed]
```

### State H — Executed trip detail (locked)
Trip header normal but with 🔒 indicator. All edit affordances replaced with read-only displays. Footer: "Executed [date]. [Reopen]" link. Items show their current location as the trip's destination.

### State I — Reopening a trip
Modal:
```
Reopen "June 2026 NL trip"?

This trip is currently locked as a record. Reopening will let you
edit the manifest. Use only to fix mistakes — items have already
physically moved.

The execution date will be cleared until you mark executed again.

[Cancel]  [Reopen]
```

### State J — Trip card with weight warning
A trip card on the Trips view that has at least one suitcase over its limit shows a small warning indicator: "⚠ 1 suitcase overweight". Tapping the trip detail surfaces which suitcase.

## Edge cases

- **EC1** A trip is created with destination = origin (typo). → Allowed. Some "trips" are within a city. The app doesn't second-guess.

- **EC2** A trip's departure_date is in the past, but status is still `planned`. → Allowed. Maybe the user is logging a past trip retroactively. UI shows the trip in Past section if departure_date < today AND status is planned (a "logged after the fact" state).

- **EC3** A user changes a trip's destination after items are already in suitcases. → Hard block if any item's destination doesn't match the new trip destination. Same resolution dialog as box destination mismatch (from location-tracking spec).

- **EC4** A user cancels a trip with packed suitcases. → Confirm dialog explaining: "N items in M suitcases will be returned to 'unpacked' state; you can re-pack them into other boxes/trips." On confirm: trip status becomes `canceled`, suitcase `trip_id` cleared, `box_type` becomes `cardboard`, `suitcase_class` cleared. Items inside stay in the (now-cardboard) box.

- **EC5** A trip is executed but the user realizes one item didn't actually go (forgot at home). → Reopen the trip per AC21. Remove the item from its suitcase. Re-execute. The forgotten item now has no `box_id` and stays in its previous location.

- **EC6** A suitcase's weight_limit is set very low (e.g., 5 lb) by mistake. → Save it. Weight gauge shows over-limit immediately if any items are in it. User can edit the limit upward. No magic correction.

- **EC7** Two users edit the same trip simultaneously. → Last-write-wins on Supabase. Acceptable for trip metadata. For suitcase contents, the existing item-to-box pattern handles it (the same item can't be in two suitcases at once).

- **EC8** A user adds the same item to two different suitcases on the same trip via different phones simultaneously. → The first save sets `box_id`. The second save updates `box_id` to the new value. No item is duplicated; it just ends up in the second suitcase. Mostly a non-issue in practice.

- **EC9** Migration not run, but app updated. → Save attempts include trip-related fields; Postgres rejects. App falls back to saving without trip data and toasts: "Run SQL migration 2g in Settings to enable trip tracking." Same pattern as previous migrations.

- **EC10** A user creates a trip but never adds any suitcases. → Allowed. The trip is just a calendar entry. Marking it executed has no effect on items (since there are no suitcases).

- **EC11** A user marks a trip executed but no suitcases have any items. → Allowed. The trip shifts to executed status as a record-only event. No items move.

- **EC12** A trip's destination_location_id references a location that's been deleted. → The location-tracking spec already prevents deletion of locations in use. If somehow a stale reference exists, fall back to displaying the location ID with a "(unknown)" label. App doesn't crash.

- **EC13** Bilingual: user creates a trip with English name only, no Italian. → Save with `name_it = null`. Display falls back to English alone in both languages. Same pattern as locations.

- **EC14** Items inside a suitcase need re-derivation under new rules (per the rule-versioning system). → Re-derivation works the same way. If new rules would change the item's destination to one that doesn't match the suitcase's trip destination, the existing destination-mismatch hard-block applies. User must resolve.

- **EC15** A trip executed long ago (e.g., 6 months) gets reopened. → AC21 confirmation is shown but the action proceeds normally. The 30-day soft window mentioned in AC18 is informational, not enforced. (We considered a hard 30-day cutoff but decided against it — the user is the source of truth.)

- **EC16** Three trips planned within the same week (busy travel season). → All three appear in Upcoming. No special handling. User packs them independently.

- **EC17** A suitcase's weight gauge displays unknowns: some items have `pounds = null`. → Display: "23 of 50 lb (+ 2 unknown)". Both the gauge and the warning logic skip unknowns. Adding a 0-lb item to the count would create a false-positive "we're under the limit" feeling.

- **EC18** User wants to track that an item went on a trip but doesn't want to specify a suitcase. → Out of scope; suitcases are required for trip-packed items. If they don't want suitcase granularity, they can use a single suitcase per trip.

## Out of scope

- **Real airline policy lookups.** Cernita doesn't know what KLM allows on a Detroit-Amsterdam flight. The user enters limits manually. Future spec could add a small per-airline reference card, but not now.

- **Actual flight booking integration.** Cernita is not a travel app. No flight numbers, no carrier APIs, no boarding pass storage.

- **Multi-leg trips.** A trip is one departure → one destination. If your June trip is Galesburg → Amsterdam → Munich → Galesburg, you create one trip ("June 2026 NL/DE") with origin and destination as the dominant pair. We don't model layovers.

- **Travel insurance value calculations.** A trip's manifest could be useful for travel insurance, but generating a "declared value" report is a separate concern (likely the insurance manifest spec, future).

- **Trip cost calculations.** Cernita doesn't track airfare, hotels, etc. A trip is a logistical container for items, not a budget.

- **Sharing trips with non-household members.** No "send manifest to family" feature. The user can export the CSV with the existing export, which now includes trip context.

- **Suitcase photo capture.** Like box content photos in the location-tracking spec — out of scope. Per-item photos already exist.

- **Tracking which boxes get checked vs. shipped on the same trip.** A trip is suitcase-only. If items are also being shipped via a freight forwarder concurrent with the trip, those are tracked as cardboard boxes with a current location like "in transit (FedEx)" — separate from the trip.

- **Itinerary changes / rebooking.** If a trip's dates change, the user edits the trip. No special workflow for "trip delayed" vs "trip on time."

- **Customs declaration generation specifically for trips.** A trip's manifest can feed into the future customs PDF spec, but that's a separate piece of work.

## Open questions

- **Q1:** Should a single item be allowed to be in multiple trips' suitcases simultaneously? (E.g., "if I don't take it in June, it goes in October")
  **A:** No. An item has a single `box_id` (which is either a cardboard box or a suitcase). It's in one place at a time. If June trip doesn't take it, the user removes it from June's suitcase and adds it to October's.

- **Q2:** Should trips have a "draft" status (before "planned") for tentative trips that might not happen?
  **A:** No. Three statuses (planned, packing, executed, plus canceled and the implicit cancellation of deletion) are enough. If a trip might not happen, the user keeps it as planned and cancels later if needed.

- **Q3:** Should the AI consider trips when initially evaluating an item?
  **A:** Mostly yes, but defer to the family-destinations spec (the next one). For now: AI doesn't know about trips, just suggests destinations. The trip assignment happens after the AI's decision in the "Pack into box" flow.

- **Q4:** What if both partners are on the same trip with bags each? Two suitcases per traveler?
  **A:** Yes — each suitcase is its own box. A trip can have any number of suitcases. The traveler_name on the trip is the dominant traveler; suitcase names can clarify (e.g., "Marco's checked" / "Elena's checked").

- **Q5:** Should past trips show on the Bins tab "By location" view?
  **A:** No. Past trips' suitcases (now executed) appear in their destination location like any other box. The trip context is preserved on the box but not shown in the Bins view. The Trips view is the home for trip-context display.

- **Q6:** Can a suitcase be re-used across multiple trips?
  **A:** No. A suitcase is created for one trip and ends up wherever that trip ends. If the same physical bag is being carried on a future trip, the user creates a new suitcase. (Real-world bag identity is not tracked; what's tracked is the manifest.)

- **Q7:** Should the trip's notes field allow markdown / rich text?
  **A:** No. Plain text only, like all other notes fields. Keep formatting concerns out of the data.

- **Q8:** When a trip is `canceled`, do its items return to "loose" status?
  **A:** Per EC4: items stay in the (now-cardboard) box. The box just becomes a regular cardboard box, no longer associated with a trip. User can repurpose or unpack.

All open questions resolved.

## References

- **Constitution Principles 1, 2, 4, 5, 9, 11, 12** — multiple touched
- **Spec dependencies:** location-tracking (must ship first); bilingual item names (shipped); bilingual rationale (shipped)
- **Subsequent dependent spec:** family-destinations.md (depends on this one for cost math)
- **Airline weight allowances (typical international economy):** Checked 50 lb / 23 kg, Carry-on 22 lb / 10 kg, Personal item 16 lb. KLM, United, Delta, Lufthansa, Air France all approximate these. Premium classes get more; Ryanair and other low-cost get less.

## Implementation notes

### Sequencing within this spec

This Tier 3 spec ships in three commits:

1. `feat(schema): trips table, boxes extended with suitcase fields, migration 2g` — pure data model. Default values for box_type ensure backward compatibility.

2. `feat(trips-crud): Trips view, trip detail, suitcase management, item assignment` — the meat of the feature. Trip lifecycle, suitcase CRUD, weight enforcement.

3. `feat(execution): trip execution workflow, lock/reopen flow, location update propagation` — the execute-and-lock mechanic. Shipping this last means the previous commits are useful even before lock semantics are wired up.

### Suitcase as box: implementation pattern

Don't create parallel rendering paths. Wherever boxes appear (Bins tab, Detail overlay, picker dropdowns), the same code handles cardboard and suitcase, branching on `box_type` only for visual differentiation (icon, weight gauge style).

```javascript
function renderBoxCard(box) {
  const isStitch = box.box_type === 'suitcase';
  const limit = isSuitcase ? box.weight_limit_lb : null;
  const icon = isSuitcase ? '🧳' : '📦';
  // Same weight gauge, different threshold logic
  // ...
}
```

### Compatibility check extended

Update the existing `canAssignToBox` from location-tracking spec:

```javascript
function canAssignToBox(item, box) {
  if (item.final_decision !== box.destination) return false;
  // For suitcases: also check trip exists and is in a valid status
  if (box.box_type === 'suitcase') {
    const trip = state.trips.find(t => t.id === box.trip_id);
    if (!trip) return false;
    if (trip.status === 'executed' || trip.status === 'canceled') return false;
  }
  return true;
}
```

### Trip execution function

```javascript
async function executeTrip(tripId) {
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip || trip.status === 'executed') return;

  // 1. Update all suitcases assigned to this trip
  const suitcases = state.boxes.filter(b => b.trip_id === tripId);
  for (const suitcase of suitcases) {
    await updateBox(suitcase.id, { current_location_id: trip.destination_location_id });
    suitcase.current_location_id = trip.destination_location_id;
  }

  // 2. Update trip status
  await updateTrip(tripId, { status: 'executed', executed_at: new Date().toISOString() });
  trip.status = 'executed';
  trip.executed_at = new Date().toISOString();

  // Items inside suitcases inherit location automatically via the existing
  // `itemCurrentLocationId` helper from location-tracking spec.
  hapticTap('success');
  showToast(`Trip "${trip.name}" executed. ${countItems(suitcases)} items moved to destination.`);
}
```

### Lock enforcement

Locked trips are enforced at two layers:

1. **UI:** edit affordances are hidden/disabled when `trip.status === 'executed'`.
2. **Save layer:** before any database update of a suitcase's contents or trip metadata, check the trip status. Reject mutations on executed trips with a clear error.

This belt-and-suspenders approach prevents both accidental UI and racy concurrent edits.

### Reopen mechanic

```javascript
async function reopenTrip(tripId) {
  if (!confirm('Reopen this executed trip? Use only to fix mistakes.')) return;
  await updateTrip(tripId, { status: 'packing', executed_at: null });
  // Suitcases stay where they are physically (the locations don't roll back).
  // The user manually edits if they want to change the manifest.
}
```

Note: reopening does NOT roll back the suitcase locations. The user's items are still physically at the destination. The reopen just unlocks editing.

### State management

Add to global state:
- `state.trips` — array of trip records
- Loaded on init alongside `state.log`, `state.boxes`, `state.locations`

### Tab/sidebar navigation update

The existing tab nav has 5 tabs: Evaluate, Log, Bins, Discuss, Settings. Trips makes 6. On mobile, this is fine (icons are small). On desktop sidebar, plenty of room.

Order: Evaluate, Log, Bins, **Trips**, Discuss, Settings. Trips between Bins and Discuss because the workflow flows from "what do I have" (Log) → "where is it" (Bins) → "when is it traveling" (Trips) → "are we aligned" (Discuss).

### CSS additions

- Suitcase icon and class label in box cards (small visual delta from cardboard)
- Status pill colors per trip status (planned ink-soft, packing gold, executed olive, canceled terracotta-soft)
- Lock icon style for executed trips (🔒 with the existing label styling)
- Trip card layout (slightly different from box card — emphasizes route and dates)

### Migration testing

Manual checklist before merging:
- Fresh install: works
- Existing user runs migration 2g: works without losing existing boxes (`box_type` defaults to 'cardboard')
- Creating a trip, adding suitcase, adding items, marking executed: end-to-end works
- Weight limits enforced on suitcases (hard block, not soft warning)
- Destination mismatch hard-blocks on suitcase add (consistent with cardboard)
- Lock/reopen mechanic preserves data correctly
- Two phones see same trips/suitcases in real time (Supabase sync works)
- Old phone with cached HTML degrades gracefully (ignores new fields)
