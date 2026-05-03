# Bilingual item names

> Every evaluated item is saved with both an English and an Italian name, so future customs documents, bin labels, and exports use the appropriate language without retroactive translation.

| | |
|---|---|
| **Status** | shipped (2026-04-27) |
| **Tier** | 2 (small feature, ~80–150 lines changed, includes schema migration) |
| **Branch** | `feat/bilingual-item-names` (merged) |
| **Author** | Cernita team |
| **Drafted** | 2026-04-27 |
| **Last updated** | 2026-04-27 |
| **Constitution principles** | Principle 11 (bilingual output); Principle 12 (compliance with destination requirements — downstream dependency) |
| **Supersedes** | none |

---

## Problem

Item names in `cernita_entries` are stored only in English. When we eventually generate a customs manifest (Modello 4), insurance inventory, or bin label for the Italian destination, we need each item's name in Italian. The current schema and AI prompt produce only `item_name`.

Three concrete consequences if we don't address this now:

1. **Retroactive translation cost grows linearly with usage.** Every item saved without an Italian name becomes technical debt. By the time we have 500 items, retrofitting becomes a multi-hour batch job that we'll do under the time pressure of an actual move.

2. **Translation accuracy is best at evaluation time.** When the AI is already analyzing a photo, it has visual context to choose the right Italian term (distinguishing *vogatore* from *macchina da remo* for a rower, *trapano a percussione* from *trapano avvitatore* for a drill). Doing it later, in batch, from text alone, loses that context and produces worse translations.

3. **Constitution Principle 11 is violated by default.** Every new save without an Italian name is a violation. We need to fix the source, not patch downstream.

## Why now

Constitution Principle 11 was added in v1.2 and made bilingual output non-negotiable for all permanent records. Item names are the single most-reused permanent record — they appear in Log, Detail, Bins, Discuss, CSV export, and (planned) the customs manifest, insurance inventory, and physical bin labels.

Adding the Italian column now is cheaper than retroactively translating later. Doing it before significant item volume is logged ensures bilingual is the default forever, not an afterthought.

This is also a deliberately small, well-scoped first feature for testing the spec-driven methodology end-to-end. If it adds value here, it'll add more value on larger features.

## User story

> As one of the two people doing this move, I want every item I evaluate to be saved with both an English and an Italian name. Months from now, when we generate the customs manifest, the Italian names are already there — accurate, in context, not something I scramble to produce the week before shipment.
>
> When I view items in the Log, I see English (my working language) prominently, with Italian below in italic — a quiet reminder of where this is all going. When I open an item's detail, both names appear with equal weight.
>
> If I have items I evaluated before this feature shipped, I can press a button in Settings to backfill Italian names, and watch progress as it runs.

## Acceptance criteria

- [ ] **AC1** When the AI evaluates an item (photo or text mode), the JSON response includes both `item_name` (English) and `item_name_it` (Italian)
- [ ] **AC2** The Italian name uses correct Italian terminology, not literal word-for-word translation. A rowing machine is *vogatore*, not *macchina di canottaggio*
- [ ] **AC3** The `cernita_entries` table has a new column `item_name_it text` (nullable for backward compatibility)
- [ ] **AC4** New entries save both names to the database
- [ ] **AC5** The Log view list displays English as primary (existing 17px Cormorant Garamond), Italian below in italic 13px ink-soft Cormorant Garamond when present
- [ ] **AC6** The Detail overlay displays both names with equal visual prominence (same size, English above Italian, hairline separator between)
- [ ] **AC7** The Bins tab item rows display English as primary, Italian below in smaller italic when present
- [ ] **AC8** CSV export includes both `item_name_en` and `item_name_it` columns; the existing `Item` header is renamed to `Item (EN)` to avoid ambiguity
- [ ] **AC9** Existing entries (created before this migration, with `item_name_it = null`) display the English name only — no empty Italian slot, no "translation pending" indicator
- [ ] **AC10** A new "Translate existing items" button in Settings → Maintenance runs a backfill: for each entry where `item_name_it is null`, calls Claude with the English name + visible context and saves the returned Italian
- [ ] **AC11** The backfill shows progress (`Translating N of total`) and updates the database one entry at a time so a mid-run failure doesn't lose progress
- [ ] **AC12** The backfill respects rate limits — sequential calls with ~200ms delay, no parallelization
- [ ] **AC13** A user can manually edit the Italian name in the Detail overlay (text input field), saving on blur

## Data model changes

One additive column. No data loss possible; backward compatible with all existing entries.

```sql
-- Migration 2d: add Italian item name column
alter table cernita_entries
  add column if not exists item_name_it text;
```

No index needed (we don't filter or sort on this column). No backfill in the migration itself — backfill is a user-triggered action via the UI.

This migration is added as **migration step 2d** in the Settings setup guide, alongside existing migrations 2b (pounds + bin_id + rules versioning) and 2c (calls table).

## UI states

### State A — AI evaluation in progress
Loading skeleton already shows a placeholder for the item name. No change needed; both names will populate together when the response returns.

### State B — Result card with both names (new entry)
The result card's `item-name` div shows English as it does today. A new line below shows the Italian name in italic Cormorant Garamond, 16px, ink-soft.

```
Concept2 Model D rower
   Vogatore Concept2 Model D
HIGH CONFIDENCE — KEEP-ITALY
```

### State C — Log entry with both names
The log entry's name area gets a second line. User-tag, date, meta info shift slightly down. Total log entry height grows by ~16px when Italian is present.

```
[thumb]  Concept2 Model D rower
         Vogatore Concept2 Model D       (italic, 13px, ink-soft)
         → ITALIA
         Marco · Apr 27 · 8 ft³
```

### State D — Log entry with English only (legacy)
Identical to current rendering. No empty slot, no placeholder, no "translation pending" badge. Absence of Italian is silent.

### State E — Detail overlay with both names
The `item-name` div shows English as primary at existing size and styling. A new line below shows Italian at the *same* size, italic, ink color (not ink-soft — for a detail view, both deserve full prominence). A horizontal hairline between them.

```
Concept2 Model D rower
─────────────
Vogatore Concept2 Model D       (italic, same size as English)
```

A small edit pencil icon appears next to the Italian name. Clicking it converts the line to an inline text input.

### State F — Detail overlay editing the Italian name
The Italian name line becomes an `<input>`. Save and cancel icons appear. On save: PATCH the database, update local state, return to display mode. On cancel: revert.

### State G — Settings backfill button (no items to translate)
Disabled state. Label: "All items translated ✓". Subtitle: "0 items missing Italian names."

### State H — Settings backfill button (items pending)
Active state. Label: "Translate existing items". Subtitle: "N items missing Italian names." Below: a small note: "Cost estimate: ~$N (sequential calls at ~$0.001 each)."

### State I — Backfill in progress
Button changes to disabled with label "Translating N of total..." A progress bar underneath fills as items complete. Below, a live-updating list of the most recent 5 translations: `Concept2 Model D rower → Vogatore Concept2 Model D ✓`. Completed items animate in.

### State J — Backfill completed
Toast: "Translated N items, M failed". Button reverts to "Translate existing items" — disabled if no untranslated items remain. Failed items appear in a small expandable section showing English name + error reason; user can retry individually.

## Edge cases

- **EC1** AI returns `item_name` but no `item_name_it` (model glitch). → Save English, leave Italian null, log a warning toast: "Italian name unavailable, will need backfill". User experience: same as legacy entry until backfilled.

- **EC2** AI returns Italian text in the wrong language (e.g., Spanish "ordenador" instead of Italian "computer"). → No automatic detection in v1. User can manually edit via State F. We rely on the AI's track record of correctly identifying the requested language.

- **EC3** Two users edit the same Italian name simultaneously from two phones. → Last-write-wins on the database. Low-stakes (a name, not a decision); no conflict UI needed.

- **EC4** The Italian name is significantly longer than English ("drill" → "trapano elettrico a percussione"). → UI must not truncate. Wrap to 2 lines if needed in the Log view.

- **EC5** Existing CSV exports referenced by external tools may break when the column header changes. → Flag in PR migration notes. Update CHANGELOG.md.

- **EC6** Backfill is interrupted (browser closed, network drops). → Each translation saves as it completes. Reopening the app shows remaining count; user can resume.

- **EC7** Backfill encounters an entry with empty/null English name. → Skip it, count as failed, log entry ID. Don't error the whole batch.

- **EC8** User manually edits English name after Italian is set. → Italian is NOT auto-retranslated. A "Re-translate" button appears next to the Italian name in Detail overlay; user explicitly triggers if desired. Avoids silent overwrites of user-edited Italian.

- **EC9** Database schema migration not yet run, but app updated. → Save attempts include `item_name_it` field, Postgres returns "column does not exist". App catches this, falls back to saving without the new field, shows a one-time toast: "Run SQL migration 2d in Settings to enable Italian names."

- **EC10** User on an old phone (cached HTML) loads new entries from a partner using the new schema. → New `item_name_it` field in API response is simply ignored by old code. No error. User sees English-only display until they refresh to the new app version.

## Out of scope

- **Translation of decision rationales.** Separate spec; rationales are longer, contain numbers, need different prompting
- **Translation of flags / handling warnings.** Separate spec; same reasoning
- **Translation of UI labels (buttons, tabs, settings).** Constitution Principle 11 explicitly scopes bilingual to permanent records. Interface stays primarily English with existing decorative Italian phrases
- **Customs PDF format generation.** Separate spec; depends on this being shipped first
- **Insurance manifest export.** Separate spec
- **Bin label printing (physical labels).** Separate spec
- **Auto-detection of which language an existing item name is in.** Out of scope; users edit manually
- **Italian-first display anywhere in the UI.** English is primary in the running app. Only exports destined for Italy go Italian-primary
- **Translation of past `notes` field content.** Notes are user-authored; the user owns those and translates as they wish
- **Translation of `bin_id` strings.** Bin IDs are short codes (KI-04, KT-A); translation is meaningless

## Open questions

- **Q1:** Should the backfill batch translate multiple items in a single API call to save cost?
  **A:** Not in v1. Single-item calls keep the prompt focused, avoid context pollution between items, make per-item failure isolation easy. If we hit cost concerns at scale, batch later.

- **Q2:** Do we want a "translation quality flag" for cases where the AI's confidence is low?
  **A:** Not in v1. User can manually edit. Adding a confidence indicator adds UI complexity for a rare case. Revisit if we see frequent bad translations.

- **Q3:** Should the Log filter buttons also work on Italian text?
  **A:** Future work. v1 has no text search, so this is moot until we add one.

- **Q4:** Should the Discuss view's disagreement matching consider Italian names? (currently matches by normalized English)
  **A:** Future work. v1 keeps disagreement matching on English only. Revisit if users start manually translating English names. Not blocking.

- **Q5:** What does the AI do for items with no good Italian equivalent (US-only products, specific brands)?
  **A:** Use the brand name as-is in Italian, with descriptive Italian terms around it. "KitchenAid Artisan stand mixer" → "Impastatrice planetaria KitchenAid Artisan". Brand stays untranslated.

All open questions resolved. Spec moves to `accepted` status when human reviewer confirms.

## References

- **Constitution Principle 11** — Bilingual output, English and Italian, always
- **Constitution Principle 12** — Compliance with destination requirements (this spec is a prerequisite for downstream customs/insurance work)
- **Anthropic Messages API** — used in `evaluateImage()` for AI calls
- **Existing Cernita migration step 2c** — pattern to follow for the new `item_name_it` column

## Implementation notes

1. **Two places change in the AI flow:**
   - `buildSystemPrompt()` — add Italian naming instructions and update the JSON schema
   - The result-parsing code in `evaluateImage()` — already passes the full result object to display, so no parser change needed if we use `result.item_name_it` consistently

2. **Detail overlay rendering** — the existing `item-name` div is reused in multiple places. Consider extracting a small `renderItemName(entry)` helper that returns the bilingual block consistently. Reduces drift.

3. **Settings → Maintenance section** doesn't exist yet. The backfill button needs a new Settings subsection. Title: "Manutenzione · Maintenance". Add a section divider in the Settings tab.

4. **Backfill rate limiting** — a 200ms delay between calls is sufficient and prevents hammering. Use `await new Promise(r => setTimeout(r, 200))` between iterations.

5. **Backfill cost estimate** — calculation: ~150 input tokens + ~30 output tokens per call ≈ $0.001 per item with Sonnet 4.5. Display as `~$N` with reasonable rounding. Underestimate slightly to avoid surprise.

6. **Schema migration** — add to Settings migration block 2b (the cumulative migration list) AND create a standalone block 2d for users who already migrated through 2c. Both use `add column if not exists` for idempotency.

7. **Italian translation prompt addition:**
   > Also return `item_name_it`: the Italian translation of the item name, using correct Italian terminology (not literal word-for-word). Brand names stay untranslated. Examples:
   > - "Concept2 Model D rower" → "Vogatore Concept2 Model D"
   > - "Drill (Bosch)" → "Trapano elettrico Bosch"
   > - "KitchenAid stand mixer" → "Impastatrice planetaria KitchenAid"

8. **CSS** — bilingual name block can reuse existing typography tokens. No new CSS variables needed. Italian-name styling for the Log view: `font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 13px; color: var(--ink-soft); margin-top: 1px;`

9. **Translation backfill logging** — failures should log to console with entry ID and English name. Don't write failures to the database (would clutter `cernita_entries`); show in the live progress UI and let the user retry.
