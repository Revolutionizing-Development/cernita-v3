# Italian customs declaration

> Generate a compliant, itemized customs declaration for personal goods being imported into Italy by American citizens relocating from the United States — ready to hand to a spedizioniere (customs broker) or file directly at the port of entry.

| | |
|---|---|
| **Status** | draft |
| **Tier** | 2 (moderate — no new database entities; data collection additions on existing items, plus document generation UI) |
| **Branch** | `feat/italian-customs` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-05-05 |
| **Last updated** | 2026-05-05 |
| **Constitution principles** | Principle 1 (user owns the decision — the app prepares the declaration, not submits it); Principle 2 (honest math — values shown to user before export; no hidden assumptions); Principle 10 (specs over code); Principle 11 (bilingual — the declaration itself is in Italian, with English reference column); Principle 13 (preservation is part of the math — declared status affects how items are handled at customs) |
| **Supersedes** | none |
| **Depends on** | Spec 006 (location-tracking — KEEP-ITALY items and box manifests); Spec 007 (trips-suitcases — air shipment manifests are separate customs events from ocean freight); PDF export spec (planned; spec number TBD — this spec generates the document content; a companion PDF export spec handles rendering and download) |

---

## Problem

When American citizens move personal goods into Italy, Italian customs (Agenzia delle Dogane e dei Monopoli, ADM) requires a formal declaration to claim the duty-free exemption for personal effects. Without this document, goods arriving at an Italian port or airport may be held, assessed at full import duty rates, or seized.

Cernita already tracks every item the couple plans to bring to Italy: its name in English and Italian, estimated value, weight, volume, and decision (KEEP-ITALY). What it doesn't do is turn that data into the specific document Italian customs needs — an "elenco beni mobili" (itemized goods list) attached to a "dichiarazione di trasferimento di residenza" (residence-transfer declaration).

Three concrete costs of doing this manually:

1. **Double-entry risk.** Manually typing 200 items into a customs spreadsheet after they've already been logged in Cernita is a second chance for errors — wrong values, wrong names, missed items.

2. **Compliance gaps.** The legal threshold for the duty-free exemption under EU Regulation 1186/2009 is that goods must be declared in Italian, categorized, and accompanied by a sworn statement. A casual Excel file doesn't satisfy this. Items missing from the declaration are not covered by the exemption even if they otherwise qualify.

3. **Customs broker cost.** A spedizioniere charges to prepare this document if the client can't provide it. Cernita can generate a ready-to-sign draft that the broker only needs to review and stamp.

## Why now

1. **The user's move timeline is real.** Ocean freight to Italy is a long-lead event. Customs documentation must be prepared before the container ship departs. Missing this window means waiting months for the next shipment.

2. **The data already exists.** Cernita tracks KEEP-ITALY items with bilingual names and values. The gap is small: acquisition dates and a few declarant fields. Better to collect those as items are evaluated than to reconstruct them retroactively for 200 objects.

3. **The output is a document, not a feature.** There is no ongoing maintenance burden once generated. This spec's complexity is bounded.

## User story

> As an American citizen establishing residency in Italy, I need to provide Italian customs with a formal declaration of the personal goods I'm importing — so that we qualify for the duty-free exemption on used household items we've owned for more than six months.
>
> Cernita already knows what we're bringing to Italy. I want to open a "Customs Declaration" section, confirm or fill in any missing fields (especially purchase year for each item, and my declarant details), and generate a complete Italian-language declaration document that I can hand to our spedizioniere.
>
> I need the document to list every KEEP-ITALY item, grouped by category (as Italian customs expects), with Italian item names, quantities, approximate values in EUR, and the statement that these goods are for personal use and have been in my possession for more than six months.
>
> I also need separate declarations for air shipments versus ocean freight, because customs events happen at different ports and different times.
>
> The document should be ready to print and sign. I don't need the app to submit anything — I just need the correctly structured, Italian-language content.

## Legal context: Americans vs. EU citizens

**This is important and non-obvious.** The spec user is an American citizen, not an EU citizen. This changes several things.

### Applicable regulation
EU Regulation 1186/2009 (Article 3) grants duty-free importation of personal property to "natural persons transferring their normal place of residence from a third country to the Community." American citizens moving from the US to Italy qualify under this third-country provision — but only if they meet the conditions:

1. They were **normally resident** in the country of origin (USA) for at least 12 consecutive months immediately preceding the move.
2. Each item has been in **personal use** for at least 6 months prior to import.
3. Items are imported within **12 months** of establishing Italian residence.
4. The person **declares** the goods at the port of entry (or via a customs broker on their behalf).
5. A sworn declaration ("dichiarazione sostitutiva di atto notorio") accompanies the goods list.

### What does NOT qualify for exemption
- New or unused items (even bought for personal use)
- Items purchased in the 6 months before import
- Commercial quantities of anything
- Alcohol (capped at small personal amounts)
- Motor vehicles (separate process)
- Items the person does not own (rented, borrowed)

### The document structure Italian customs expects
- **Cover declaration** ("dichiarazione di trasferimento di residenza"): identifies the declarant (name, date of birth, nationality, prior address, new Italian address), asserts 12 months prior residence, asserts personal use, and swears that the attached list is complete and accurate.
- **Attachment: Elenco beni** ("elenco analitico dei beni mobili di uso domestico e personale"): itemized table with columns — n., descrizione del bene (Italian), quantità, valore stimato (EUR), anno di acquisto (or "da oltre 6 mesi").
- Items are grouped by customs category: mobili e oggetti di arredamento, abbigliamento, libri e documenti, apparecchiature elettroniche, strumenti musicali, oggetti d'arte e valore affettivo, utensili da cucina, attrezzature sportive e per il tempo libero, altri beni personali.
- Filed with the Italian customs authority at the port of arrival. For ocean freight arriving at e.g. Genova or Livorno, the spedizioniere files on behalf of the declarant. For air freight or personal carry, the declarant presents it at the airport customs desk.

### American-specific additional requirements
- Proof of prior US residence: not something Cernita generates, but the declaration references it (the app prompts the user to confirm they have the documentation: utility bills, tax returns, etc.).
- Proof of Italian residency establishment: lease, codice fiscale, visa, or registrazione anagrafica. Again, referenced but not generated by Cernita.
- For large ocean shipments, an Italian customs agent (spedizioniere doganale) is required by law to file the formal entry. The document Cernita generates is the pre-filing draft.

## Acceptance criteria

### Declarant profile (one-time setup)

- [ ] **AC1** Settings gains a "Customs Declaration" subsection. First time the user opens it, a setup wizard collects: full legal name (both declarants if two), dates of birth, nationalities (pre-filled "American" but editable), US address (prior residence), Italian address (destination), target Italian customs office (dropdown: port of entry — Genova, Livorno, Napoli, Roma Fiumicino, or "Other/TBD"), intended date of arrival. These are stored in app settings, not the database.

- [ ] **AC2** The wizard explains — in plain language — that it is preparing a declaration under EU Regulation 1186/2009 Article 3, and that American citizens qualify under the third-country provision. A plain-language note: "As US citizens, you qualify for the same duty-free exemption as EU residents — but only for items you've owned and used for more than 6 months."

- [ ] **AC3** A "both declarants" toggle: if only one person is the legal declarant (common when one partner is the primary permit-holder), the declaration is in one name. If both, both names appear on the cover and the declaration is joint.

### Per-item customs fields

- [ ] **AC4** `cernita_entries` gains two new nullable columns: `acquisition_year` (integer, year the item was purchased or acquired) and `customs_eligible` (boolean, nullable — null = not yet assessed, true = qualifies for exemption, false = does not qualify). No other schema changes are needed for v1.

- [ ] **AC5** The Detail overlay for KEEP-ITALY items gains a "Customs" section with: acquisition year field (number input, labeled "Year acquired · Anno di acquisto"), an "Owned 6+ months?" derived indicator (green checkmark if acquisition_year ≤ current year − 1, or if current year and user explicitly toggles "Yes"), and a free-text "Notes for customs" field.

- [ ] **AC6** When acquisition_year is not set for a KEEP-ITALY item, the item appears with a warning indicator in the customs review screen (State C). The declaration cannot be generated until all KEEP-ITALY items have either an acquisition year or are explicitly marked "exclude from declaration."

- [ ] **AC7** The estimated value field already exists on `cernita_entries`. For customs, values must be in EUR. The declaration screen shows values converted using a stored EUR/USD exchange rate that the user sets manually (no live feed — Principle 2: honest math, user owns the rate). Default rate is shown and labeled "approximate — verify before filing." Exchange rate stored in app settings alongside the declarant profile.

- [ ] **AC8** A per-item "Exclude from declaration" toggle. Items excluded are not listed in the generated document. A warning appears if excluded items have `final_decision = KEEP-ITALY`: "This item is marked KEEP-ITALY but excluded from the customs declaration — it will not be covered by the exemption."

- [ ] **AC9** Items with `acquisition_year` in the current year or the year before (meaning potentially less than 6 months of ownership) are flagged with an amber "Verify ownership period" badge. The declaration can still include them, but a footnote is added to that item's line: "Acquisition date to be verified."

- [ ] **AC10** A "customs category" field per item, drawn from the fixed Italian customs category list (see legal context above): Mobili e arredamento, Abbigliamento, Libri e documenti, Elettronica, Strumenti musicali, Arte e oggetti di valore affettivo, Cucina e utensili, Sport e tempo libero, Altri beni personali. Default is auto-assigned by the AI based on the item's Italian name (a lightweight heuristic, not an API call — rule-based mapping). User can override.

### Declaration review screen

- [ ] **AC11** A new "Customs" tab (or a prominent action in the Bins tab) leads to the customs declaration review screen (State B). This screen lists all KEEP-ITALY items grouped by customs category.

- [ ] **AC12** The review screen shows per-category totals: item count, total estimated value in EUR. A grand total at the bottom.

- [ ] **AC13** A completeness indicator at the top: "N items missing acquisition year · N items value unknown." These are drill-down links to the incomplete items.

- [ ] **AC14** The review screen has a "Split by shipment" toggle: "All KEEP-ITALY items together" vs. "By shipment." The "By shipment" view shows which items are assigned to ocean freight (boxes with KEEP-ITALY destination, no trip assignment) vs. which are traveling via a specific air trip (from spec 007). Each shipment produces a separate declaration document, because each is a separate customs event at a different port on a different date.

- [ ] **AC15** The review screen's "Generate declaration" button becomes active only when: declarant profile is complete, exchange rate is set, and all non-excluded KEEP-ITALY items have an acquisition year.

### Generated document content

- [ ] **AC16** The generated declaration is a structured data payload (JSON or structured text) consumed by the PDF export feature (dependency). It contains: (a) the cover declaration text in Italian with blanks for fields filled from the declarant profile; (b) the itemized goods table, sorted by customs category then by item name (Italian); (c) a summary table by category.

- [ ] **AC17** The cover declaration text follows the standard Italian format for "dichiarazione sostitutiva di atto notorio" (self-certified declaration under DPR 445/2000). Key assertions it makes:
  - Il/La sottoscritto/a [NAME], nato/a il [DOB] a [BIRTHPLACE], cittadino/a [NATIONALITY], dichiara di trasferire la propria residenza da [US ADDRESS] a [ITALY ADDRESS].
  - That the declarant was resident in the United States for at least 12 consecutive months prior to the move.
  - That all goods listed in the attachment have been in personal use for the period indicated.
  - That the goods are not intended for commercial or resale purposes.
  - That the list is complete and accurate to the best of the declarant's knowledge.
  - Date and signature line.

- [ ] **AC18** Each row in the goods table contains: progressive number (n.), descrizione (Italian name from `name_it`), quantità (quantity, default 1), valore stimato (EUR value), anno di acquisto, note (customs notes if any). Items flagged as "verify ownership" get an asterisk with a footnote.

- [ ] **AC19** The document includes a header identifying it as "Allegato alla dichiarazione di trasferimento di residenza — Elenco analitico dei beni mobili di uso domestico e personale." Regulation 1186/2009 is cited by number.

- [ ] **AC20** A disclaimer footer in Italian and English: "This document was prepared using Cernita. It is a draft for review by the declarant and their authorized customs broker before filing. The declarant is responsible for its accuracy."

### Separate ocean freight vs. air shipment declarations

- [ ] **AC21** Ocean freight declaration covers: all KEEP-ITALY items assigned to boxes that are NOT associated with a trip (spec 007). These arrive via container at an Italian seaport.

- [ ] **AC22** Each air trip declaration (from spec 007) covers: all KEEP-ITALY items assigned to suitcases in that trip. Each trip generates its own declaration document, dated for that trip's travel date.

- [ ] **AC23** Items not yet assigned to a box or trip but marked KEEP-ITALY appear in an "Unassigned — will appear in ocean freight declaration" holding group. The user can move them or leave them; the ocean freight declaration will include them unless they're reassigned to a trip.

### Bilingual

- [ ] **AC24** The generated document is primarily in Italian (as required by Italian customs). English item names appear as a reference column in smaller type, labeled "Riferimento inglese" — so the declarant can cross-check. The cover declaration is Italian only.

- [ ] **AC25** The review screen UI is in both English and Italian per standard Cernita conventions.

## Data model changes

```sql
-- Migration 015: Italian customs declaration fields
-- Adds two nullable columns to cernita_entries.
-- No new tables needed — declarant profile lives in app settings.

alter table cernita_entries
  add column if not exists acquisition_year integer,
  add column if not exists customs_eligible boolean,
  add column if not exists customs_category text,
  add column if not exists customs_notes text,
  add column if not exists customs_exclude boolean default false;

create index if not exists idx_cernita_entries_customs_category
  on cernita_entries (customs_category)
  where final_decision = 'KEEP-ITALY';
```

### App settings additions (not database — stored in Supabase user metadata or a settings row)

```
declarant_name_primary: string
declarant_dob_primary: date
declarant_nationality_primary: string (default "Americana/Americano")
declarant_name_secondary: string | null
declarant_dob_secondary: date | null
customs_us_address: string
customs_italy_address: string
customs_port_of_entry: string
customs_arrival_date_estimate: date | null
customs_eur_usd_rate: decimal (e.g. 0.92)
customs_both_declarants: boolean
```

These settings are separate from the economic parameters (storage rate, etc.) already in Settings.

### What Cernita already has (no changes needed)

| Field | Source | Customs use |
|---|---|---|
| Italian item name (`name_it`) | `cernita_entries.name_it` | Primary description in goods list |
| English item name (`name_en`) | `cernita_entries.name_en` | Reference column |
| Estimated value (USD) | `cernita_entries.estimated_value` | Converted to EUR using stored rate |
| Decision | `cernita_entries.final_decision` | Filter: KEEP-ITALY items only |
| Weight (lb) | `cernita_entries.weight_lb` | Informational; customs doesn't require per-item weight but it helps the broker |
| Volume (cu ft) | `cernita_entries.volume_cuft` | Same — informational |
| Box assignment | `cernita_entries.box_id` | Determines ocean vs. trip assignment |
| Trip assignment | Via `cernita_boxes` → `cernita_trips` (spec 007) | Determines which air declaration |

## UI states

### State A — Settings → Customs Declaration setup (first time)
Wizard with 4 steps:
1. Declarant identity (name, DOB, nationality, joint or sole declarant).
2. Addresses (US address, Italian address).
3. Customs logistics (port of entry, estimated arrival date, EUR/USD rate).
4. Confirmation summary with "Save & continue to declaration review" button.

Each step has a plain-language note explaining why the field is needed and how Italian customs uses it.

### State B — Customs Declaration review screen (main)
Top: completeness indicator ("12 items need attention — 8 missing acquisition year, 4 missing value"). Below: "Split by shipment" toggle. Then: categories accordion (Mobili e arredamento, Abbigliamento, etc.), each collapsible. Each category shows item count + EUR total. Inside: item rows with acquisition year, value, customs category, exclusion toggle, edit action.

Bottom: total summary (N items, EUR X total value) and "Generate declaration" button (disabled until complete). If split by shipment is on, two buttons: "Generate ocean freight declaration" and "Generate [trip name] declaration."

### State C — Incomplete items list
Drill-down from completeness indicator. Items missing acquisition year listed with inline edit field. Tab between them. "Mark all as pre-2024 (owned 6+ months)" bulk action for users who know all their household goods easily predate the move.

### State D — Item detail: Customs section
Inside the existing Detail overlay, a collapsible "Customs · Dogana" section appears only for KEEP-ITALY items. Fields: acquisition year, customs category (with auto-assigned value and override), customs notes (free text), exclude toggle. If acquisition year is in the current or previous year, amber flag with explanation.

### State E — Per-shipment preview
Clicking "Preview" before generating shows the full structured content in a read-only view (not yet PDF). Column headers visible: N., Descrizione, Riferimento inglese, Quantità, Valore stimato (EUR), Anno di acquisto, Note. User can spot errors before committing to PDF generation.

### State F — Generate confirmation
Before generating, a summary: "This declaration covers N items with a total estimated value of EUR X. Ocean freight estimated arrival: [port], [date estimate]. Once generated, save the PDF securely — you will need it at customs." Two buttons: "Generate" and "Cancel." No progress indicator needed (generation is synchronous and fast).

### State G — Post-generation
Shows a success state with: "Declaration ready — [shipment name]." Two actions: "Download PDF" (calls PDF export feature) and "Copy to clipboard" (plain text fallback). A note: "This is a draft. Have your spedizioniere or legal advisor review it before filing."

## Edge cases

- **EC1** User has KEEP-ITALY items with no Italian name (`name_it` is null). → Flag these in the completeness indicator. Block declaration generation until either Italian name is added or item is excluded. The Italian-language requirement is not optional.

- **EC2** Estimated value is null for some items. → Flag in completeness indicator. User can either add a value, or explicitly set "value unknown — estimate used" with a user-typed estimate. The declaration will note these as "valore stimato approssimativo."

- **EC3** EUR/USD rate is not set. → Block generation. Show link to Settings → Customs where the rate is entered. Default is the previously set rate if available.

- **EC4** User has 0 KEEP-ITALY items. → Declaration review screen shows an empty state: "No items are currently marked KEEP-ITALY. When you have items to bring to Italy, they will appear here."

- **EC5** User changes a previously-generated declaration (adds items, changes values). → The previous PDF is not invalidated in the app — it's a file the user has. The review screen shows: "Your declaration data has changed since the last generation. Regenerate before filing." Tracked by storing a `last_generated_at` timestamp and `last_generated_hash` of the declaration content in settings.

- **EC6** An item is excluded from the declaration but is KEEP-ITALY and arrives in Italy. → This is the user's legal risk; Cernita cannot prevent it. The exclusion warning (AC8) is the disclosure.

- **EC7** Joint declarant scenario: only one partner owns certain items. → No per-item ownership tracking in v1. The declaration is joint ("i sottoscritti") and covers all KEEP-ITALY items. Per-owner attribution is out of scope.

- **EC8** User has >200 KEEP-ITALY items. → Declaration generation still works. The goods list may be long; that is normal and expected. A "total pages" estimate appears in the preview.

- **EC9** Motor vehicles. → If a vehicle is marked KEEP-ITALY, it is excluded from this declaration automatically (motor vehicle imports require a separate process: IVA, registration, homologation). A warning appears: "Vehicles cannot be declared here — consult your customs broker separately."

- **EC10** Wine, spirits, or tobacco items marked KEEP-ITALY. → Flag with warning: "Italian customs restricts personal import of alcohol and tobacco. Quantities above personal-use limits are dutiable regardless of exemption. Verify limits with your broker." Not blocked, but prominently warned.

- **EC11** The couple is traveling from Colorado Springs, not Illinois. → The declaration's "prior residence" address reflects wherever they actually resided when filing. The app doesn't hard-code any US address — it's a field the user fills in (AC1).

- **EC12** Box-assigned items vs. trip-assigned items. For items not yet assigned to either, the ocean freight declaration is used as the default. If the user later assigns to a trip, the review screen updates to show them in the trip declaration instead.

- **EC13** Trip executed (spec 007's "Mark trip executed" workflow) before the customs declaration is generated. → Trip items are still included in the corresponding trip declaration, even post-execution. The execution date becomes the import date on the declaration.

- **EC14** Declaration saved as PDF and then the item data changes. → See EC5. The PDF on the user's device is authoritative at the time of filing. Cernita tracks the hash and warns on mismatch.

- **EC15** Acquisition year entered as, say, 1985 for antiques. → No restriction. Items more than 50 years old may have additional Italian import considerations (cultural goods rules), but Cernita does not adjudicate this — it generates the declaration and includes the year as entered. A general note in the declaration footer advises consulting a broker for items of potential cultural significance.

## Out of scope

- **Submitting the declaration to the Italian customs API.** The app generates the document; a licensed spedizioniere files it. Automated filing is out of scope for all versions.
- **Calculating actual customs duty.** If exemption is denied (items less than 6 months old, or other grounds), the duty is calculated per HS code, value, and EU tariff schedule. This is complex enough to be a separate spec if ever needed.
- **Motor vehicle import process.** Separate workflow, separate authorities, not addressed here.
- **HS tariff code assignment.** For personal-effects exemption, HS codes are not required item by item. If they ever are needed (e.g. items denied exemption), this becomes a separate feature.
- **Italian VAT (IVA) calculation.** Falls under actual duty if exemption is denied. Out of scope.
- **Tracking filing status or customs response.** Cernita generates the document; what happens after is outside the app.
- **Managing the "proof of prior residence" documents** (US utility bills, tax returns). Cernita references them in the declaration text but does not store or manage them.
- **ATA carnets or temporary import.** Not relevant to a permanent relocation.
- **Customs for goods staying in the US (KEEP-US, SELL, DONATE).** Only KEEP-ITALY items require Italian customs declaration.
- **Live EUR/USD rate feed.** User sets rate manually per Principle 2.
- **Second shipment / amendment declarations.** If a second ocean freight container follows the first, the user generates a new declaration for those items. No "amendment" workflow in v1.

## Open questions

- **Q1:** Should the customs category auto-assignment be rule-based (keyword matching on Italian name) or a one-time AI call?
  **Draft answer:** Rule-based for v1. A small lookup table mapping keywords to categories is fast, offline, and predictable. AI call would add latency and API cost for a one-time categorization that the user can override.

- **Q2:** Should declarant profile fields be stored in Supabase (so they sync between two phones) or only in localStorage/device?
  **Draft answer:** Supabase, in a settings row. Both partners need the same declarant profile, and accessing it from one phone to pre-fill the other is the expected pattern (Principle 4: two people, one truth).

- **Q3:** How should we handle items where `name_it` was set by AI and may be grammatically incorrect for a customs document?
  **Draft answer:** Flag them in the review screen as "AI-generated Italian name — verify." A dedicated "Review Italian names" sweep mode (or a column in State E preview) lets the user go through them quickly before generating.

- **Q4:** When is the best time to collect `acquisition_year` — at item evaluation time or during customs review?
  **Draft answer:** Both. Add an optional acquisition year field to the Evaluate flow (AC5), but do not require it there — the customs review screen (State C) provides a dedicated completion sweep. Collecting it early is better, but not at the cost of slowing the evaluation flow.

- **Q5:** Should the generated declaration be a PDF or an editable DOCX?
  **Draft answer:** PDF, via the PDF export spec dependency. The content is legally sensitive and should not be casually editable once generated. If the user needs to make changes, they regenerate from Cernita (ensuring the source of truth stays in the app).

## References

- **EU Regulation No 1186/2009** — Council Regulation on the system of Community reliefs from customs duty. Article 3 (personal property on transfer of residence from a third country).
- **DPR 445/2000** — Italian Presidential Decree on administrative documentation: governs the "dichiarazione sostitutiva di atto notorio" (self-certified sworn declaration) that the cover letter must follow.
- **ADM (Agenzia delle Dogane e dei Monopoli)** — Italian customs authority. Their circulars define acceptable form for personal-effects declarations.
- **Constitution Principles 1, 2, 3, 10, 11, 13** — multiple touched.
- **Spec 006 (location tracking)** — KEEP-ITALY items and box manifests.
- **Spec 007 (trips-suitcases)** — Air shipment manifests.
- **PDF export spec (planned, TBD)** — Renders the document content from this spec into a downloadable PDF.
