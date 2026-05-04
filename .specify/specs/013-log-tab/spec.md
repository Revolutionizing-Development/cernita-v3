# Log tab

> The history of every decision made. A live list, a detail overlay, and the ability to override, re-derive, or delete any entry — without touching the camera.

| | |
|---|---|
| **Status** | draft |
| **Tier** | 3 (substantial — detail overlay, re-derivation flow, delete with confirmation) |
| **Branch** | `feat/log-tab` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-05-04 |
| **Last updated** | 2026-05-04 |
| **Constitution principles** | Principle 1 (user owns the decision — override and delete live here); Principle 2 (honest math — economics table visible in detail); Principle 4 (two people, one truth — both users' evaluations appear); Principle 5 (decisions versioned — stale badges visible here); Principle 11 (bilingual — item names and rationale shown in both languages) |
| **Supersedes** | Log view from v1.x single-file app |
| **Depends on** | Spec 009 (authentication); Spec 010 (stack); Spec 011 (core evaluation — defines the data); Spec 005 (log search — search bar is an additive feature on top of this spec) |

---

## Problem

The Evaluate tab is where new items are added. The Log tab is where everything that's been added lives. It needs to do three things well:

1. **Browse** — scan the full list quickly, understand the shape of decisions so far.
2. **Inspect** — tap any item and see the full detail: math, rationale, preservation flags, who decided, when.
3. **Correct** — override a wrong decision, accept a re-derived one, or delete a duplicate without going back through the camera flow.

None of these need a camera. All of them need the full data. The Log tab is the library.

## User story

> I evaluated 40 items last week. This week I changed the storage rate. Several entries are now stale — the math has changed. I open the Log. I see which entries have an "Outdated" badge. I tap one and see the diff: old recommendation was KEEP-ITALY at $47 net; new math says SELL at $90 resale beats storage by $40. I accept the new decision. It saves. I move to the next stale item.
>
> Later my partner sees I marked the cast iron pan as SELL. She disagrees. She opens the Log, finds it, taps it, and overrides to KEEP-ITALY with a reason: "that pan is irreplaceable, sentimental." Her override sticks. The item now shows her name as the override author.

## Acceptance criteria

### List view

- [ ] **AC1** The Log tab shows all `cernita_entries` rows in reverse chronological order (`created_at DESC`). The list is loaded from `AppContext.log` — no additional API call on tab open.

- [ ] **AC2** Each row in the list shows:
  - Photo thumbnail (32×32 rounded square; gray placeholder if no photo)
  - Item name (English, Lato, 15px)
  - Italian name italic subline (*nome in italiano*, ink-soft, 13px) — omitted if null
  - Decision badge (color-coded, compact): see badge colors below
  - `user_name` + formatted date (e.g. "Marco · 2 days ago"), ink-soft, 12px

- [ ] **AC3** Decision badge colors:

| Decision | Color |
|---|---|
| KEEP-ITALY | olive background, paper text |
| KEEP-TEXAS | olive-soft background, ink text |
| SELL | terracotta background, paper text |
| DONATE | ink-soft background, paper text |
| DISPOSE | ink background, paper text |
| GIVE-FAMILY | terracotta-soft background, ink text |
| NEEDS-HUMAN | gold background, ink text |

- [ ] **AC4** If an entry is outdated (current rules would produce a different decision), the row shows a small amber "⟳ Outdated" indicator alongside the badge.

- [ ] **AC5** If an entry has `user_confirmed = true` and `override_reason` set, the row shows a small "↩ Override" indicator in ink-soft.

- [ ] **AC6** Filter controls appear above the list: one pill per decision type + an "Outdated" pill. Tapping a pill filters to that type. Multiple pills can be active simultaneously. An "All" pill resets filters. Spec 005 (search) adds a search bar above these pills.

- [ ] **AC7** A summary bar at the top of the tab shows total item count and a mini breakdown: e.g. "87 items · 34 Italy · 18 Sell · 12 Donate · …" When filters are active: "Showing 18 of 87."

### Detail overlay

- [ ] **AC8** Tapping any row opens a detail overlay (slides up from the bottom, full-height sheet on mobile, centered modal on desktop ≥768px). The overlay is dismissible by swiping down or tapping the background.

- [ ] **AC9** The detail overlay shows:
  - Photo (full-width, aspect-ratio: 4/3, rounded corners, gray placeholder if no photo)
  - Item name (English, Cormorant Garamond, 22px) · *Italian name* (italic, 18px)
  - Decision badge (same as list, larger)
  - "Evaluated by [user_name] · [date]" line, ink-soft
  - **Economics table** (not collapsed):
    - Ship cost | Storage cost | Sell value
    - Net cost ship | Net cost storage
    - Weight (lb) | Volume (cu ft) | Resale est. | Replacement est.
  - Confidence pill (high / medium / low) + label
  - Rationale (English paragraph, normal weight)
  - *Rationale italiana* (italic paragraph, ink-soft)
  - **Preservation block** (only if `fragility` ≠ 'none'):
    - Fragility level badge
    - Survival risk (English + Italian italic)
    - Packing notes (English + Italian italic)
  - Override reason (if set): small block "↩ [user_name] overrode: [reason]"
  - Rules version used: "Rules v[version] · [date set]" in ink-soft 12px

- [ ] **AC10** If the entry is outdated, the detail overlay shows a prominent diff block above the economics table:

  ```
  ⟳ Rules updated since this evaluation.
  Previous recommendation: KEEP-ITALY ($47 net cost)
  New recommendation: SELL ($90 resale beats $51 storage + ship)

  [Accept new decision]  [Keep this one]
  ```

  "Accept new decision" updates `final_decision`, `net_cost_*`, `recommendation_rationale`, `rules_version`, and `rules_snapshot` in the database. `override_reason` is cleared. "Keep this one" marks the entry as up to date without changing the decision (sets `rules_version` to current — the user is explicitly keeping the old decision).

### Actions from detail

- [ ] **AC11** An "Override decision" button (secondary, below the economics table) opens an inline form within the overlay:
  - Decision type dropdown (7 options, bilingual labels)
  - Override reason textarea (optional but encouraged; placeholder: "Why are you changing this?")
  - [Cancel] and [Save override] buttons
  Saving updates `final_decision`, `user_confirmed = true`, `override_reason`, and `user_name` (re-attributes to the overriding user).

- [ ] **AC12** A "Delete entry" button (destructive, small, at the bottom of the overlay) shows a confirmation: "Delete [item name]? This cannot be undone." Confirm permanently removes the row. The overlay closes and the list updates.

- [ ] **AC13** After any save action (accept re-derivation, override), the overlay stays open showing the updated state. A brief toast confirms: "Saved · Salvato." The list behind updates in real time.

### Realtime

- [ ] **AC14** The Log list is kept current by the Supabase Realtime subscription established in `AppContext` (spec 010). When the other partner evaluates an item on their phone, it appears in the list immediately — no manual refresh.

- [ ] **AC15** If an entry currently open in the detail overlay is updated by the other partner via Realtime, the overlay shows a subtle "Updated by [name]" notice and re-renders the changed fields. It does not close or lose scroll position.

## Data model changes

None. The Log tab reads from and writes to `cernita_entries` as defined in spec 011. No new columns or tables.

## UI states

### State A — List, no filters, entries present
Full list in reverse chronological order. Summary bar at top. Filter pills below it. Each row showing photo, names, badge, attribution.

### State B — Filter active
Active filter pill highlighted (terracotta underline or terracotta text). List shows only matching entries. Summary bar reads "Showing N of M."

### State C — Empty log
No entries yet. Centered empty state: "No items evaluated yet." / *Nessun oggetto valutato ancora.* A hint arrow or button pointing toward the Evaluate tab.

### State D — Empty log after filter
Filter returns no results. Empty state specific to filter: "No [SELL] items." with "Clear filters" button.

### State E — Detail overlay, current entry
Overlay visible at full height. All fields rendered. Two primary actions: [Override decision] and [Delete entry].

### State F — Detail overlay, outdated entry
Same as State E but with the diff block above the economics table. Two actions in the diff block plus the standard Override and Delete below.

### State G — Override form open
The override inline form replaces the [Override decision] button within the overlay. Decision dropdown, reason textarea, [Cancel] and [Save override].

### State H — Delete confirmation
A small confirmation prompt replaces the [Delete entry] button: "Delete [item name]? This cannot be undone. [Cancel] [Delete]"

## Edge cases

- **EC1** Log has 500+ items. The list renders efficiently — no virtualization needed at this scale (React's default reconciliation is fast enough for 500 rows). If performance degrades visibly beyond 1000 items, add windowing in a future spec.
- **EC2** Both partners open the same entry's detail overlay simultaneously and both override. Last-write-wins. The second partner's overlay shows "Updated by [name]" and re-renders with the first partner's save before the second one saves.
- **EC3** Entry has `photo_data = null`. Gray placeholder renders; no broken image, no error.
- **EC4** Deleting an entry that's in a box (`box_id` set). The delete proceeds; `cernita_boxes`'s item count decreases implicitly (it's derived, not stored). No cascade needed.
- **EC5** Re-derivation produces `NEEDS-HUMAN`. The accept button text reads: "Mark as needs discussion." The user is acknowledging the math changed, not necessarily accepting a new recommendation.
- **EC6** Very long override reason (e.g. 2000 chars). Allow it. Truncate display in the row indicator to 80 chars with "…"; show full text in the detail overlay.
- **EC7** User taps "Keep this one" on an outdated entry. The entry's `rules_version` is updated to current, `rules_snapshot` is updated, but `final_decision` is unchanged. The "Outdated" badge disappears.

## Out of scope

- **Editing fields other than decision type.** You can't edit item name, weight, resale value, etc. from the Log. Those came from the AI; changing them would require a re-evaluation. Future spec.
- **Sorting by other fields** (decision, user, weight, cost). Reverse-chronological only. Filtering by decision type covers most use cases without full sort.
- **Batch operations** (delete multiple, re-derive all from here). "Re-derive all" lives in Settings; batch delete is out of scope.
- **Sharing / exporting a single entry.** CSV export (spec 012) covers the full log. Per-entry export is out of scope.
- **Comments or discussion threads per entry.** That's the Discuss tab.
- **Log pagination or infinite scroll.** Load all entries; render them all. Virtual scrolling if we hit real performance problems.

## References

- Constitution Principles 1, 2, 4, 5, 11
- Spec 005 (log search — adds search bar above the filter pills)
- Spec 011 (core evaluation — defines `cernita_entries` schema)
- Spec 010 (stack — Realtime, AppContext)
