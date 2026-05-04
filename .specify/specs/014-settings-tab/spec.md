# Settings tab

> User-facing configuration only. Rates, thresholds, model choice, and maintenance utilities. No database URLs, no API keys, no household anything.

| | |
|---|---|
| **Status** | draft |
| **Tier** | 2 (small — mostly form inputs wired to a settings object; the maintenance section has a few async operations) |
| **Branch** | `feat/settings-tab` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-05-04 |
| **Last updated** | 2026-05-04 |
| **Constitution principles** | Principle 2 (honest math — the rates used in evaluation are visible and overridable here); Principle 3 (data belongs to the user — export lives here); Principle 7 (architecture serves the user — no infrastructure fields); Principle 8 (honest about limits — limitations disclosed where relevant) |
| **Supersedes** | Settings tab from v1.x single-file app |
| **Depends on** | Spec 009 (authentication — sign out lives here, user name comes from auth); Spec 011 (core evaluation — rates feed into the AI prompt); Spec 012 (CSV export — export button lives here) |

---

## Problem

The old Settings tab was a minefield: database URLs sat next to storage rates, API keys sat next to the user's name. The non-technical partner had to navigate past infrastructure to change anything personal. That was a direct violation of Principle 7.

The new Settings tab has one rule: if a user wouldn't need to call a developer to set it, it lives here. If they would, it lives in Vercel environment variables.

## Acceptance criteria

### Identity section

- [ ] **AC1** The top of Settings shows the authenticated user's display name (from `user_metadata.display_name`) and email. Read-only — not editable in-app. Below: "Not [name]? [Esci · Sign out]".

- [ ] **AC2** "Esci · Sign out" (per spec 009 AC6) ends the session and navigates to the login screen.

### Economic parameters

- [ ] **AC3** A "Rates & assumptions · Tariffe e ipotesi" section contains:
  - **Storage rate** — number input, labeled "$/cu ft/month · $/piede cubo/mese", default 2.50. Tooltip: "The monthly cost per cubic foot at your storage unit. Affects whether shipping beats storage for items going to Italy."
  - **Ocean shipping rate — per pound** — number input, labeled "$/lb · $/libbra", default 0.75
  - **Ocean shipping rate — per cu ft** — number input, labeled "$/cu ft · $/piede cubo", default 4.00
  - **Months in storage** — integer input, labeled "Months · Mesi", default 18. Tooltip: "How many months items will sit in storage before the ocean shipment. Affects storage cost totals."
  - **Carry-on cost** — display only, shows "$0 · Gratuito". Tooltip: "Items carried on a flight cost nothing extra. This assumption is built in and not configurable."

- [ ] **AC4** All rate inputs are number inputs with `step="0.01"` for currency and `step="1"` for months. Values persist to `localStorage` under a `cernita_settings` key. They are loaded at app startup before any evaluation.

- [ ] **AC5** After changing any rate, a notice appears below the section: "⟳ [N] entries were evaluated under different rates. Go to Log → Outdated filter to review." This count is computed from `AppContext.log` — no API call.

- [ ] **AC6** The rates object used in each evaluation is snapshotted into `rules_snapshot` at save time (per spec 011 AC12). Changing rates here does not retroactively change saved entries — it only affects future evaluations and re-derivations.

### Weight thresholds

- [ ] **AC7** A "Weight limits · Limiti di peso" section (relevant once spec 006 ships) contains:
  - **Soft warning threshold** — number input, labeled "lb, soft warning · libbra, avviso", default 50
  - **Hard warning threshold** — number input, labeled "lb, hard warning · libbra, avviso bloccante", default 70
  - A note: "These are ergonomic thresholds for safe single-person lifting. Ocean LCL freight charges by volume, not weight — the limit there is structural, not financial."

- [ ] **AC8** Weight thresholds persist to `localStorage` alongside rates and are consumed by spec 006's box weight logic.

### AI model

- [ ] **AC9** A "AI model · Modello AI" section shows a dropdown with available Claude models. Options at minimum:
  - `claude-opus-4-5` — "Most thorough · Più accurato (slower, higher cost)"
  - `claude-sonnet-4-5` — "Balanced · Bilanciato (recommended)"
  - `claude-haiku-4-5` — "Fastest · Più veloce (lower cost)"

  The selected model is sent to `/api/anthropic` with each evaluation request. Default: `claude-sonnet-4-5`.

- [ ] **AC10** Model selection persists to `localStorage`. A note below the dropdown: "Model affects evaluation quality and speed. Changing it applies to the next evaluation."

### Maintenance section

- [ ] **AC11** A "Maintenance · Manutenzione" section contains the following utilities. The section has a slightly darker background (`--paper-dark`) to visually distinguish it from the preference sections above.

- [ ] **AC12** **Export CSV · Esporta CSV** — the primary export button (per spec 012 AC1). Labeled "Download all items as CSV · Scarica tutti gli oggetti come CSV". Triggers the CSV export function from spec 012.

- [ ] **AC13** **Re-derive outdated entries · Rideriva voci obsolete** — a button that runs the economics formula locally against current rates for every entry where `rules_version` doesn't match the current version. Displays the count of entries to update: "Re-derive 14 outdated entries." On completion, a toast: "14 entries updated · 14 voci aggiornate." No AI call — pure math re-derivation.

- [ ] **AC14** **Backfill Italian names · Aggiungi nomi italiani** — a button that sends any entry with `item_name_it = null` through the AI for a bilingual name translation only (no full re-evaluation). Shows count: "12 items missing Italian name." On completion: "12 items updated." Shows a progress indicator while running (this makes multiple API calls).

- [ ] **AC15** **Backfill preservation data · Aggiungi dati di conservazione** — same pattern as AC14. Sends entries with `fragility = null` through the AI for a preservation assessment. Shows count and progress.

- [ ] **AC16** Each maintenance button is disabled (grayed) with an explanatory label when there is nothing to do: "All entries up to date · Tutto aggiornato ✓".

### No infrastructure fields

- [ ] **AC17** Settings contains no fields for: Supabase URL, Supabase anon key, Household ID, Worker/Cernita URL, Household password. These were removed per spec 009 AC13 and must not reappear.

## Settings persistence

Settings are stored in `localStorage` under the key `cernita_settings` as a JSON object. They are never sent to the database. If `localStorage` is cleared, settings revert to defaults — the user re-enters their preferred rates. This is acceptable: defaults are sensible and the values are easily recalled.

```typescript
interface CernitaSettings {
  storageRatePerCuFt: number;        // default 2.50
  shippingRatePerLb: number;         // default 0.75
  shippingRatePerCuFt: number;       // default 4.00
  monthsInStorage: number;           // default 18
  weightSoftThresholdLb: number;     // default 50
  weightHardThresholdLb: number;     // default 70
  aiModel: string;                   // default 'claude-sonnet-4-5'
  rulesVersion: string;              // semver, bumped when any rate changes
}
```

`rulesVersion` is bumped automatically whenever any rate changes (e.g., from `1.0.0` to `1.1.0`). This is what drives the "outdated" detection in spec 011 AC13 and AC14.

## UI states

### State A — Settings default

All sections visible. Identity at top. Rates section. Weight limits. AI model. Maintenance at bottom with accurate counts. Sign out at very bottom.

### State B — Rates changed, outdated entries exist

After editing any rate: the notice below the rates section appears with the count. Maintenance section's "Re-derive" button shows the count and is enabled.

### State C — Re-derive in progress

Re-derive button shows a spinner. Other maintenance buttons are disabled. Progress: "Updating 14 entries… 6 done." On completion, toast and button reverts to disabled state ("All entries up to date ✓").

### State D — Backfill in progress

Same as C but for the relevant backfill. Multiple API calls run sequentially (not parallel — to avoid rate limits). Progress counter visible.

### State E — All maintenance actions satisfied

All three maintenance buttons show the disabled/complete state. The section reads cleanly.

## Edge cases

- **EC1** `localStorage` is unavailable (private browsing mode on some browsers). Fall back to in-memory settings — they persist for the session. A subtle note: "Settings won't be saved between sessions in private browsing mode."
- **EC2** User sets storage rate to 0. Allowed — maybe they own the storage unit. The AI prompt includes the rate; $0/month storage shifts recommendations toward KEEP.
- **EC3** Re-derive runs on 300+ entries at once. Pure JavaScript math — no API call. Should complete in <500ms. No special handling needed.
- **EC4** Backfill Italian names: AI call fails for one entry mid-batch. Log the failure, continue to next entry, show a partial success: "10 of 12 items updated. 2 failed — try again."
- **EC5** User changes AI model between evaluations. The next evaluation uses the new model. Already-saved entries keep their original model in their rules snapshot (though we don't currently store which model was used — that's a future addition).
- **EC6** Both partners have different rate settings (one changed storage rate on their phone). Their `localStorage` settings diverge. Each evaluation is done under the evaluator's local rates, and the rates are snapshotted per entry. This is expected and documented behavior. Future: consider syncing rates to the database.
- **EC7** `rulesVersion` is bumped but the user immediately changes the rate back. The outdated count goes to 0 and the notice disappears. The version stays bumped — it's monotonically increasing.

## Out of scope

- Syncing settings between the two partners' phones (each has their own `localStorage`)
- Password change in-app (handled via Supabase dashboard)
- Display name change in-app (handled at account creation)
- Dark mode / theme toggle (future spec if needed)
- Notification preferences (no push notifications in v1)
- Language toggle (app is English-primary with Italian secondary; this is fixed by design)
- Per-item resale value or shipping overrides (those live in the evaluation flow, not Settings)

## References

- Constitution Principles 2, 3, 7, 8
- Spec 009 (authentication — sign out, user identity display)
- Spec 011 (core evaluation — rates object fed into AI prompt)
- Spec 012 (CSV export — export button rendered here)
- Spec 006 (location tracking — weight threshold inputs consumed there)
