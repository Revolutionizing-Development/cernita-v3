# Bilingual decision rationale

> Every decision rationale is saved in both English and Italian, so customs documentation, insurance manifests, and Italian-speaking helpers can read why each item was kept, sold, donated, or carried.

| | |
|---|---|
| **Status** | shipped (2026-04-27) |
| **Tier** | 2 (small feature, ~120–180 lines, includes schema migration and prompt update) |
| **Branch** | `feat/bilingual-rationale` (merged) |
| **Author** | Cernita team |
| **Drafted** | 2026-04-27 |
| **Last updated** | 2026-04-27 |
| **Constitution principles** | Principle 11 (bilingual output); Principle 12 (compliance with destination requirements — downstream dependency); Principle 2 (honest math, always shown — the rationale IS the math made human-readable) |
| **Supersedes** | none |
| **Depends on** | `/specs/bilingual-item-names.md` (shipped) — establishes the bilingual pattern this spec extends |

---

## Problem

The decision `rationale` field currently contains a single English sentence with the math comparison and reasoning. Examples from the current system prompt:

- *"Sell now: $200 cash − $250 to replace = $50 net cost. Keep+ship: $90. Selling actually wins by $40 — sell."*
- *"Keep+ship $7. Sell+replace €280-$700=−$420 (you'd LOSE money replacing). Strong keep."*

Three problems with English-only rationales:

1. **The Italian customs declaration will need rationales translated.** Modello 4 and similar declarations include "motivo" or "giustificazione" fields when items are unusual, valuable, or claimed for personal-effects exemption. Rationales explaining "this is sentimental" or "this is irreplaceable in Italy" matter at the border.

2. **Italian-speaking helpers can't read the reasoning.** Your wife's Italian colleagues, the moving company representative in Italy, the customs broker — anyone Italian-side helping with the move sees decisions but not their justifications. This causes friction at exactly the moments when fast trust matters.

3. **Constitution Principle 11 is currently violated.** Rationales are permanent records (they get exported, reviewed months later, included in customs paperwork). Principle 11 mandates bilingual for permanent records. Item names were addressed in the previous spec; rationales are the next obvious gap.

## Why now

Constitution Principle 11 made bilingual non-negotiable for permanent records. We addressed item names in the previous shipped spec; rationale is the natural follow-up — same pattern, similar size, same beneficiary downstream (customs PDF generation, insurance manifest).

Doing this now keeps the bilingual coverage consistent. Shipping it later means another batch of items evaluated in English-only that need backfilling.

A second reason: rationales are *harder to translate retroactively* than item names. Item names are 3-5 words; rationales are full sentences with numbers, currency formatting, and contextual references ("would LOSE money replacing"). Translating them requires more context than the English text alone provides. Better to capture both languages at evaluation time when the AI has the full picture.

## User story

> As one of the two people doing this move, when I open an item in the Detail overlay, I want to see the rationale in both languages — English for me (working language), Italian for the records that go to Italy.
>
> When the customs broker months from now needs to understand why we marked a worn cast-iron skillet as "irreplaceable in Italy" rather than selling it for $20, the Italian rationale is already there in the record. They don't need me to translate on the fly.
>
> When I scroll through the Log, I see the English rationale (the working view). When I open the Detail or generate any export, both languages are present.
>
> If I have items with English-only rationales from before this feature shipped, a button in Settings → Maintenance backfills them — the same pattern as the item-name backfill.

## Acceptance criteria

- [ ] **AC1** When the AI evaluates an item, the JSON response includes both `rationale` (English) and `rationale_it` (Italian)
- [ ] **AC2** The Italian rationale uses correct Italian terminology, accurate currency formatting (EUR rather than USD where appropriate, `€` symbol, decimal commas), and proper Italian sentence structure — not literal word-for-word translation
- [ ] **AC3** The `cernita_entries` table has a new column `rationale_it text` (nullable for backward compatibility)
- [ ] **AC4** New entries save both rationales to the database
- [ ] **AC5** The Result card shows the English rationale primary as today; the Italian rationale appears below in italic Cormorant Garamond at slightly smaller size when present
- [ ] **AC6** The Detail overlay shows both rationales with equal prominence, English above Italian, separated by a hairline rule, both readable
- [ ] **AC7** The Log view list does NOT show the rationale (it doesn't today) — no change needed; bilingual rationale appears only where rationale appears
- [ ] **AC8** CSV export includes both `Rationale (EN)` and `Rationale (IT)` columns; the existing `Rationale` header is renamed to `Rationale (EN)`
- [ ] **AC9** Existing entries (created before this migration, with `rationale_it = null`) display the English rationale only — no empty Italian slot, no warning
- [ ] **AC10** A new "Translate existing rationales" button in Settings → Maintenance section runs a backfill: for each entry where `rationale_it is null AND rationale is not null`, calls Claude with the English rationale + item context and saves the returned Italian
- [ ] **AC11** The backfill shows progress (`Translating N of total`) and updates the database one entry at a time so a mid-run failure doesn't lose progress
- [ ] **AC12** The backfill respects rate limits — sequential calls with ~250ms delay (slightly slower than item-name backfill since rationales use more tokens), no parallelization
- [ ] **AC13** The Italian rationale is editable in the Detail overlay using the same edit-pencil pattern established for item names (consistency with the prior spec)
- [ ] **AC14** Re-derived rationales (when rules change and `compareDecisionToCurrentRules` regenerates) are produced in both English and Italian by `deriveDecision()` — no extra API call needed since `deriveDecision` builds rationale from rules + facts deterministically

## Data model changes

One additive column. No data loss; backward compatible.

```sql
-- Migration 2e: add Italian rationale column
alter table cernita_entries
  add column if not exists rationale_it text;
```

This migration is added as **migration step 2e** in Settings, alongside existing 2b/2c/2d. The cumulative migration block (2b) is also extended.

## UI states

### State A — Result card, fresh evaluation
The existing rationale block stays as-is for English. A new italic Italian block appears below it in the same `<div class="rationale">`-style box but with italic font, slightly smaller (14px vs 15px), ink-soft color. Subtle visual hierarchy — English first, Italian second.

```
┌─ rationale (English) ────────────┐
│ Keep+ship $7. Sell+replace      │
│ €280−$700=−$420. Strong keep.   │
├─ rationale (Italian, italic) ────┤
│ Conservare e spedire $7.         │
│ Vendere e ricomprare €280−$700  │
│ = perdita di $420. Conservare    │
│ con decisione.                   │
└──────────────────────────────────┘
```

### State B — Result card, no Italian rationale (model glitch / EC1)
English rationale shown alone. No empty slot. No "translation pending" indicator. Fall back to original behavior gracefully.

### State C — Detail overlay with both rationales
Same pattern as item names in the previous spec. Both blocks shown with equal weight, hairline separator between them. English on top, Italian below. Edit pencil next to Italian for inline editing.

### State D — Detail overlay editing the Italian rationale
The Italian rationale becomes a `<textarea>` (not `<input>` — rationales are multi-line). Save and Cancel buttons appear. Save on blur or Ctrl/Cmd+Enter; Cancel reverts.

### State E — Settings → Maintenance: nothing to translate
Disabled state. Label: "All rationales translated ✓". Subtitle: "0 rationales missing Italian."

### State F — Settings → Maintenance: items pending
Active state. Label: "Translate existing rationales". Subtitle: "N rationales missing Italian. Estimated cost: ~$N (sequential calls at ~$0.002 each)." Higher per-item cost than name translation because rationales are longer.

### State G — Backfill in progress
Same pattern as item-name backfill. Progress bar fills, live recent translations feed, failures collected at the bottom.

### State H — Detail overlay for re-derived entry (AC14)
When a stale entry is re-derived using `deriveDecision()`, the rationale is regenerated from current rules. The `deriveDecision` function returns BOTH English and Italian rationale strings, formatted from a small lookup table of rule outcomes. No API call needed; deterministic, fast.

```javascript
// In deriveDecision return value:
{
  decision: 'SELL',
  reason_en: 'Net cost $50 vs runner-up $90 — sell wins by $40',
  reason_it: 'Costo netto $50 contro $90 dell\'alternativa — vendere conviene di $40'
}
```

## Edge cases

- **EC1** AI returns `rationale` but no `rationale_it`. → Save English, leave Italian null, log a warning toast (`Italian rationale missing, can backfill later`). User experience: same as legacy entry display.

- **EC2** AI returns Italian text in wrong language (rare; we rely on the model's track record). → Manual edit via State D. No auto-detection in v1.

- **EC3** Italian rationale uses `$` instead of `€` where currency context suggests Italian formatting. → Accept it; the prompt will guide toward Italian conventions but won't perfectly enforce. User can edit.

- **EC4** Italian rationale is significantly longer than English (often the case for explanatory sentences). → UI containers must wrap, not truncate. Both rationale boxes flex to content height.

- **EC5** Rationale contains math symbols (`−`, `×`, `=`) that need careful handling in Italian. → Examples in the prompt show correct Italian math expression. Model handles it.

- **EC6** Backfill encounters an entry where `rationale` itself is empty/null. → Skip it. There's nothing to translate. Don't count as failure.

- **EC7** Backfill is interrupted (browser closed). → Same as item-name backfill: each translation saves as it completes. Resume on next run.

- **EC8** User manually edits the English rationale in the future. → Italian is NOT auto-retranslated (consistent with item names spec). A "Re-translate" button could be added but is out of scope for v1.

- **EC9** Database schema migration not yet run. → Save attempts include `rationale_it`, Postgres returns column-not-exist error. App catches it, retries without the field, toasts a migration prompt. Same pattern as `item_name_it` EC9.

- **EC10** Re-derived entries (via `deriveDecision`) need bilingual rationales without an API call. → `deriveDecision()` returns both languages from a small string template table, NOT from API. Faster, cheaper, deterministic. The trade-off: re-derived rationales are formulaic ("Net cost $X vs $Y") rather than as natural as AI-generated ones. Acceptable trade-off for the value it provides (instant re-derivation).

- **EC11** AI rationale uses USD in a context where the user is reading from Italy. → v1 keeps the AI-generated currency context (USD/EUR as the AI chose). Future spec might offer toggle. For now, the rationale shows whichever currencies the AI naturally used.

- **EC12** Old phone with cached HTML loads new entries with `rationale_it`. → Field ignored silently by old code. No error. User sees English-only display until they refresh.

## Out of scope

- **Translation of `flags` field.** Separate spec; flags are short codes and warnings, different translation pattern.
- **Translation of `notes` field (user-authored).** User owns these; user translates if/when they want.
- **Auto-retranslation when English rationale is edited.** Manual control only, consistent with item-names spec.
- **Currency conversion in rationale text.** Rationale shows whatever currencies the AI used. No automatic USD↔EUR conversion in the displayed text.
- **Italian-first display of rationale.** English remains primary in the running app. Only exports going to Italy go Italian-primary (future export-format specs).
- **A "rationale quality" indicator.** Not adding signal/noise around translation confidence.
- **Bulk re-derivation triggered by rule changes also re-translating rationales.** The `deriveDecision()` function returns both languages from templates; no API needed. This is correct and intentional — keeps re-derivation cheap.
- **Translation of Discuss tab disagreement summaries.** Those are computed UI text, not stored rationales. Different concern.

## Open questions

- **Q1:** Should the Italian rationale use Italian decimal/currency conventions (e.g., `€1.000,50` rather than `€1,000.50`) or American conventions to stay consistent with the data?
  **A:** Use Italian conventions. The customs broker reading this will expect Italian formatting. The tiny inconsistency with the database (which stores numbers in standard form) is fine because we're rendering, not parsing.

- **Q2:** When `deriveDecision()` produces Italian rationale templates, should they aim for natural Italian or stay terse and formulaic?
  **A:** Terse and formulaic is fine for re-derived rationales. The user knows they're auto-generated (the rationale is prefixed with "Re-derived under rules vN"). Natural language is for AI-generated rationales.

- **Q3:** Should we cache common rationale phrases ("storage too expensive", "irreplaceable in Italy") to save tokens?
  **A:** No. Each rationale is item-specific. Caching would force generic phrasings and lose the per-item math.

- **Q4:** What about the rationale shown in the Discuss tab's override list (`<div class="log-meta">${e.rationale || ''}</div>`)?
  **A:** Show English only there — that view is for at-a-glance scanning by the working users (you and wife in English). Bilingual would clutter without value. Detail overlay (one tap away) shows both.

- **Q5:** Should AC14 (re-derived rationales bilingual) require an API call, to get more natural Italian?
  **A:** No. The whole point of `deriveDecision()` is that it's instant and free. Adding an API call would defeat that. The formulaic Italian template is acceptable for re-derived entries; users can edit if they want natural language.

All open questions resolved. Spec moves to `accepted` upon human review.

## References

- **Constitution Principle 11** — Bilingual output, English and Italian, always
- **Constitution Principle 12** — Compliance with destination requirements (downstream beneficiary)
- **Constitution Principle 2** — Honest math, always shown (rationale is math made human-readable)
- **Spec `/specs/bilingual-item-names.md`** — establishes the bilingual pattern this spec extends; same UI patterns, same migration pattern, same backfill pattern
- **Italian customs Modello 4** — eventual customs export will need rationales for personal-effects exemptions
- **Existing `deriveDecision()` function** — the rule-versioning system that produces re-derived rationales

## Implementation notes

1. **System prompt update.** Add `rationale_it` to the JSON schema. Add a "Bilingual rationale" section with 4-5 example translations showing:
   - Currency formatting (`€280` not `EUR 280`)
   - Italian number conventions (`1.000` for thousands, `,` for decimal)
   - Italian terminology (`spedire` not `shippare`, `vendere` not `sellare`)
   - Math symbols rendered the same way (math is universal)

2. **Italian rationale prompt examples** for the system prompt:
   > Also return `rationale_it`: the Italian translation of the rationale, with proper Italian conventions (€ symbol, comma decimals, Italian terminology). Examples:
   > - English: "Sell now: $200 cash − $250 to replace = $50 net cost. Keep+ship: $90. Selling wins by $40 — sell."
   >   Italian: "Vendere ora: $200 in contanti − $250 per ricomprare = $50 costo netto. Conservare+spedire: $90. Vendere conviene di $40 — vendere."
   > - English: "Keep+ship $7. Sell+replace €280−$700=−$420 (you'd LOSE money replacing). Strong keep."
   >   Italian: "Conservare+spedire $7. Vendere+ricomprare €280−$700=−$420 (perderesti denaro ricomprando). Conservare con decisione."

3. **`deriveDecision()` returning bilingual.** Update the function signature so it returns `{ decision, reason_en, reason_it }` instead of `{ decision, reason }`. Existing callers using `.reason` need to read `.reason_en`. Where the rationale gets saved during re-derivation, save both.

4. **Backward compatibility for `deriveDecision`.** Existing callers like `compareDecisionToCurrentRules` already render `.reason` in UI. Add `.reason` as alias for backward compatibility OR update all callers in this PR (cleaner). Update all callers — there are only 3.

5. **Detail overlay rationale block.** Currently a single `<div class="rationale">`. Becomes two divs (or one with internal structure). Add the same edit-pencil + textarea pattern as item names. Reuse `escapeHtml()` for safety.

6. **Settings backfill.** Reuse the patterns from item-name backfill — same Maintenance section, second button below the first. Same UI components for progress, recent feed, failures. Different translation function (translates rationale text instead of name).

7. **Translation function** — separate from `translateItemNameToItalian`. Call it `translateRationaleToItalian(englishRationale, itemContext)` where `itemContext` includes the item name (in both English and Italian if available) so the translator has full context.

8. **Cost estimate** — rationales use more tokens than names. ~250 input + ~80 output ≈ $0.002 per item. Display as `~$N` rounded sensibly.

9. **CSS** — Italian rationale styling: `font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 14px; color: var(--ink-soft); line-height: 1.5; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--paper-dark);`

10. **CSV export** — header rename `Rationale` → `Rationale (EN)`, new column `Rationale (IT)`. Same pattern as item names.

11. **`re-derived` entries** — when re-deriving, save both `rationale` (English) and `rationale_it` from the template strings. The `Re-derived under rules vN: ` prefix can stay English-only or have an Italian equivalent (`Ricalcolato secondo regole vN: `). Pick one — Italian prefix on the Italian rationale is more consistent.
