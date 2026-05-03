# Preservation-aware packing

> Track which items are vulnerable to deterioration in storage and transit. Provide per-item packing guidance (plastic bin, plastic wrap, zip-lock, desiccant). Adjust decision confidence when survival probability is genuinely in doubt. Indicate visually which boxes need to be plastic, not cardboard.

| | |
|---|---|
| **Status** | draft (pending acceptance of amendment 001) |
| **Tier** | 3 (substantial — schema changes, AI prompt changes, decision logic changes, UI changes across multiple views) |
| **Branch** | `feat/preservation` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-04-27 |
| **Last updated** | 2026-04-27 |
| **Constitution principles** | Principle 13 (preservation is part of the math — pending amendment); Principle 2 (honest math, always shown); Principle 1 (user owns the decision); Principle 9 (safety as default); Principle 11 (bilingual output) |
| **Supersedes** | none |
| **Depends on** | bilingual item names (shipped); bilingual rationale (shipped); location tracking (must ship first — uses `cernita_boxes` table) |
| **Related amendment** | `/amendments/proposed-001-preservation-principle.md` |

---

## Problem

Cernita's current decision math is incomplete. It compares:

- Storage cost + shipping cost (the cost of keeping)
- Resale value − replacement cost (the cost of selling)
- Carry-bag fee (the cost of carrying)

It doesn't compare:

- The probability that the item survives the journey at all
- The packing precautions required to give it a fighting chance
- Whether the user has the materials and discipline to follow those precautions

Three concrete failure modes:

**1. False positives on KEEP decisions.** The vintage leather jacket gets KEEP-ITALY because $50 to ship beats $400 to replace. Eighteen months in a Galesburg storage unit (humid summers, cold winters), then six weeks in an ocean container at varying temperatures and humidities, then storage at the Italian customs facility. The jacket arrives ruined. The user paid $50 to ship a destroyed item and now also pays $400 to replace it. Total: $450, when sell-now would have cost $350.

**2. No actionable packing guidance.** Even when the user does keep something fragile, they have no per-item instructions. Cast iron skillets need to be oiled and wrapped to prevent rust. Books need to be in plastic with desiccant. Vinyl records need vertical orientation in rigid containers. Cernita today says nothing about any of this.

**3. Box material is implicit.** Cardboard boxes fail at containing humidity and pests. Plastic bins (or "totes," what storage and moving people call them) cost more but are reusable, water-resistant, and protective. The user has to remember which boxes should be plastic without help. After 200 items, that memory fails.

## Why now

Three reasons:

**1. Constitution Principle 13 (proposed amendment) makes this explicit.** Once the amendment passes, preservation is no longer an optional polish feature — it's a required factor in honest math. This spec is the implementation of that requirement.

**2. The location-tracking and trips specs are foundation for this.** Boxes already exist as entities. This spec adds material and per-item packing data to the existing structures rather than building new ones.

**3. The user is about to start packing.** With the move calendar known, packing starts in the coming months. Items packed without preservation guidance now will need to be re-evaluated later. Packing materials cost more to add after-the-fact than to plan for upfront. Better to surface this now.

## User story

> As one of the two people doing this move, when I evaluate a vintage leather book, the AI tells me it's humidity-sensitive and pest-vulnerable, recommends plastic bin with desiccant, and notes that survival probability over 18 months of storage is real concern. The rationale doesn't just say "ship $7 vs replace $80 — keep." It says "ship $7 vs replace $80, but vulnerable to mold without proper packing — keep with plastic bin and desiccant, OR carry via NL trip if possible."
>
> When I'm assigning items to a box later, the app warns me if I'm putting a humidity-sensitive item into a cardboard box. It suggests I either move the item to a plastic bin or accept the risk explicitly.
>
> When I create a new box, I tell the app whether it's cardboard or plastic. The Bins view shows me at a glance which boxes are which. I can sort or filter to see "plastic bins only" when I'm packing fragile things.
>
> When I open the Detail view for a vulnerable item, I see clear instructions: wrap in plastic film, place in zip-lock, add desiccant pack, store flat in plastic bin. Bilingual, so I can show the moving company representative what we agreed.
>
> The math doesn't pretend everything will arrive intact. When something genuinely might not survive, the rationale tells me, the confidence drops, and selling-now or carrying-via-suitcase look more attractive in the comparison.

## Acceptance criteria

### Schema and data model

- [ ] **AC1** `cernita_boxes` gains a column `material text default 'cardboard'` with check constraint allowing `'cardboard' | 'plastic' | 'crate' | 'other'`. Existing boxes default to cardboard, no migration of existing data.

- [ ] **AC2** `cernita_entries` gains four boolean preservation flags: `needs_plastic_bin`, `needs_plastic_wrap`, `needs_ziplock`, `needs_desiccant`. All default false.

- [ ] **AC3** `cernita_entries` gains two text columns for nuanced cases: `packing_instructions` (English) and `packing_instructions_it` (Italian). Both nullable; populated by the AI when the item warrants specific guidance, editable by the user.

- [ ] **AC4** `cernita_entries` gains a `preservation_risk` text column with check constraint allowing `'none' | 'low' | 'moderate' | 'high' | 'severe'`. Default `'none'`. Populated by the AI based on item type and storage/transit conditions.

- [ ] **AC5** `cernita_entries` gains a `preservation_concerns` text column (English) and `preservation_concerns_it` (Italian) — short bilingual notes about what specifically threatens the item (e.g., "humidity, pest exposure" / "umidità, esposizione a insetti").

### AI prompt changes

- [ ] **AC6** The system prompt's existing "handling warnings" section is expanded to require preservation analysis. The AI returns the new fields in every evaluation:
  - `preservation_risk` — one of the five severity levels
  - `preservation_concerns` and `preservation_concerns_it` — bilingual short concern descriptions
  - `needs_plastic_bin`, `needs_plastic_wrap`, `needs_ziplock`, `needs_desiccant` — booleans
  - `packing_instructions` and `packing_instructions_it` — bilingual specific guidance, populated when risk is moderate or higher

- [ ] **AC7** The prompt includes a categorical reference for the AI:
  - **Humidity/temperature-sensitive** (most common): wood furniture, leather, books, paper, photographs, vinyl records, foam, rubber, electronics, musical instruments, fabric (especially natural fibers), oil paintings
  - **Pest-vulnerable**: wool, silk, food residue, books/paper, untreated wood
  - **Shock-fragile**: glass, ceramics, fragile electronics, items with liquid contents, framed art
  - **Chemically unstable in long storage**: foam mattresses, rubber items, adhesives, old electronics with electrolytic capacitors, batteries

- [ ] **AC8** The prompt includes example outputs covering several archetypes (vintage leather jacket, cast iron skillet, vinyl LP, KitchenAid mixer, photo album, glass vase). Each example shows the right combination of preservation_risk, concerns, packing flags, and instructions.

### Decision logic changes

- [ ] **AC9** The AI's `rationale` field, when preservation_risk is moderate or higher, includes the risk in the reasoning. Example: "Ship $7 vs replace $80, but humidity-sensitive (60% survival probability without proper packing) — keep with plastic bin and desiccant, or carry via NL trip if possible."

- [ ] **AC10** The AI's `confidence` field accounts for preservation risk. An item that wins on simple math but has high preservation risk gets `confidence: 'medium'` rather than `'high'`. Severe preservation risk caps confidence at `'low'` regardless of math.

- [ ] **AC11** The `deriveDecision()` function does NOT override decisions based on preservation. It accepts the original decision (the user's chosen final_decision) but, when re-deriving rationales, includes a preservation note in the bilingual reason fields if the entry has high or severe preservation_risk. Example: `reason_en: "net cost $50 vs runner-up $90 (preservation risk: humidity-sensitive)"`.

- [ ] **AC12** When an item has severe preservation_risk and the user has chosen KEEP-ITALY, the Detail overlay shows a small warning chip: "Severe preservation risk — review packing instructions." Tapping the chip scrolls to the packing instructions section.

### UI changes — Box material

- [ ] **AC13** Box creation flow (in the Bins tab → "+ New box") includes a material selector: cardboard / plastic / crate / other. Default: cardboard. The selected material persists with the box.

- [ ] **AC14** Box cards in both "By destination" and "By location" views display the material as a small icon: 📦 for cardboard, 🪣 for plastic, 🪵 for crate, ⬚ for other. Bilingual tooltip on hover/long-press: "Plastic bin · Contenitore di plastica."

- [ ] **AC15** When assigning an item to a box, if the item has any preservation flag set (`needs_plastic_bin = true` especially) AND the box's material is `cardboard`, show a soft warning: "This item is recommended for a plastic bin (humidity/pest resistance). Continue with cardboard anyway?" Allow override but log the override.

- [ ] **AC16** When the user overrides the warning in AC15, the box gets a small warning indicator on its card: "⚠ N items recommended for plastic." Tapping shows which items.

### UI changes — Detail overlay

- [ ] **AC17** The Detail overlay gains a "Packing guidance" section, shown only when at least one preservation flag is set OR `packing_instructions` is non-empty. Section includes:
  - A row of icons for the structured flags (plastic bin, plastic wrap, zip-lock, desiccant)
  - Below: bilingual `packing_instructions` (English primary, Italian italic subline)
  - Edit affordance for the instructions (textarea), saving on blur

- [ ] **AC18** The Detail overlay's existing handling-warnings section coexists with the new Packing guidance section. They serve different purposes: handling-warnings is about user safety (sharp, heavy, hazardous), packing-guidance is about item preservation.

- [ ] **AC19** The Detail overlay shows preservation_risk as a colored badge: none → no badge; low → ink-soft; moderate → gold; high → terracotta; severe → terracotta-bold. Visible at the top of the entry, near the decision.

### UI changes — List views

- [ ] **AC20** Log view entries display a small preservation icon when `preservation_risk` is moderate or higher. Single icon, most-severe wins: 💧 humidity, 🦗 pest, 💥 shock, 🧪 chemical. No icon for risk = none/low.

- [ ] **AC21** Bins tab "By destination" view item rows show the same preservation icon as the Log view. Compact display.

- [ ] **AC22** Log view filter buttons gain a new option: "🛡 At risk" — shows only items with `preservation_risk` of moderate or higher. Toggle, composes with existing filters.

### Settings

- [ ] **AC23** Settings → Maintenance gains a "Preservation" subsection with a backfill action: "Re-evaluate items for preservation risk." Lists current count of items missing preservation analysis. On click, runs sequential AI calls to populate the new fields for older entries. Same patterns as previous backfills.

### Bilingual

- [ ] **AC24** All preservation field labels in the UI are bilingual.
- [ ] **AC25** The AI populates both `packing_instructions` and `packing_instructions_it`, both `preservation_concerns` and `preservation_concerns_it`, in every evaluation that warrants them.

### CSV export

- [ ] **AC26** CSV export gains six new columns: `Preservation Risk`, `Preservation Concerns (EN)`, `Preservation Concerns (IT)`, `Needs Plastic Bin`, `Needs Plastic Wrap`, `Needs Ziplock`, `Needs Desiccant`, `Packing Instructions (EN)`, `Packing Instructions (IT)`. The CSV header for the existing risk-related columns gets reordered to keep preservation grouped together.

## Data model changes

```sql
-- Migration 2h: preservation-aware packing

alter table cernita_boxes
  add column if not exists material text default 'cardboard'
    check (material in ('cardboard', 'plastic', 'crate', 'other'));

alter table cernita_entries
  add column if not exists preservation_risk text default 'none'
    check (preservation_risk in ('none', 'low', 'moderate', 'high', 'severe')),
  add column if not exists preservation_concerns text,
  add column if not exists preservation_concerns_it text,
  add column if not exists needs_plastic_bin boolean default false,
  add column if not exists needs_plastic_wrap boolean default false,
  add column if not exists needs_ziplock boolean default false,
  add column if not exists needs_desiccant boolean default false,
  add column if not exists packing_instructions text,
  add column if not exists packing_instructions_it text;

-- No new indexes needed; preservation flags are filtered in JavaScript over the loaded entries
```

The cumulative migration block 2b is also extended.

## UI states

### State A — AI evaluation result, item with no preservation concerns
A normal coffee mug. preservation_risk = 'none'. No badge in the result card, no icon in the Log, no Packing Guidance section in Detail. Behavior identical to today.

### State B — Result card, item with moderate preservation risk
A vintage leather book. preservation_risk = 'moderate', flags: needs_plastic_bin, needs_desiccant. The result card shows:

```
[Vintage leather-bound book]
[Antico libro rilegato in pelle]
🛡 Moderate preservation risk
KEEP-ITALY · Medium confidence
$7 to ship vs $120 to replace, but humidity-sensitive (60-75% survival
probability without proper packing) — keep with plastic bin and desiccant.
[$7 vs $120 di sostituzione, ma sensibile all'umidità...]

Packing guidance:
🪣 Plastic bin    🌱 Desiccant
Wrap loosely in acid-free tissue, place in zip-lock with silica gel
desiccant, then in plastic bin away from other items.
[Avvolgere in carta velina senza acidi, mettere in busta zip con gel di
silice, poi in contenitore di plastica lontano da altri oggetti.]
```

### State C — Detail overlay, item with severe preservation risk
A 1950s reel-to-reel tape recorder. preservation_risk = 'severe'. Banner at top:

```
⚠ Severe preservation risk
Old electrolytic capacitors will likely fail in long storage. Magnetic
heads sensitive to humidity. Consider carrying via suitcase or selling
to a collector now.
```

Tapping the banner scrolls to the Packing guidance section, which has the AI's specific instructions.

### State D — Box assignment, cardboard box + plastic-bin-required item
The user is in the Detail overlay of the leather book and taps "Pack into box." The picker shows compatible boxes. BOX-007 (cardboard, KEEP-ITALY) is shown but with a small warning indicator: "⚠ Cardboard." Tapping it triggers a confirm:

```
This item is recommended for a plastic bin (humidity-sensitive,
pest-vulnerable). BOX-007 is cardboard.

[Cancel]  [Pick plastic bin instead]  [Continue, override warning]
```

### State E — Box card with override warning
After the user overrides, BOX-007's card on the Bins tab shows:
```
📦 BOX-007 · KEEP-ITALY
12 items · 38 lb
⚠ 1 item recommended for plastic
```

### State F — Settings → Maintenance backfill
A new card under the existing translation backfills:
```
🛡 Preservation analysis
14 items lack preservation analysis (created before this feature shipped).
Estimated cost: ~$0.04 to re-evaluate.

[Re-evaluate items for preservation risk]
```

Click runs the AI on each, populating the new fields. Standard progress UI like the bilingual backfills.

### State G — Log view filter
The existing filter row gains a new chip: "🛡 At risk." Active, it filters to items with preservation_risk in (moderate, high, severe). Composes with decision and stale filters.

### State H — Bilingual packing instructions, edit mode
In the Detail overlay, tapping the edit pencil next to packing_instructions opens a textarea (English) and below it another textarea (Italian). Both editable. Save on blur or Cmd+Enter.

## Edge cases

- **EC1** AI returns preservation_risk but no packing_instructions for a moderate-risk item. → Save what was returned. The item shows the risk badge and concerns but no specific instructions. User can add instructions manually if desired.

- **EC2** AI returns conflicting flags (e.g., needs_plastic_bin=true but says "store in cardboard, climate controlled" in the instructions). → Trust the structured flags for filtering/sorting; show the instructions as written. The user resolves the conflict by reading both.

- **EC3** Item is added to a plastic bin but has no preservation flags. → No issue, no warning. Plastic bins can hold any item; the warning only flows the other direction (preservation-vulnerable item in cardboard).

- **EC4** Box material is changed from plastic to cardboard while it contains preservation-vulnerable items. → Warning at the moment of change: "N items in this box are recommended for plastic. Change material anyway?" Allow override, set the warning indicator on the box.

- **EC5** Item's preservation flags change (re-evaluation finds new risk) while item is in a cardboard box. → No automatic action. The next time the user views the box or the item, the appropriate warnings appear.

- **EC6** Old version of app (without preservation columns) loads new entries. → Fields ignored. No error. Display falls back to pre-preservation behavior.

- **EC7** Migration 2h not yet run, but app updated. → Save attempts include preservation fields. Postgres rejects. App falls back to saving without them, toasts "Run SQL migration 2h in Settings." Same pattern as previous bilingual migrations.

- **EC8** User explicitly disagrees with AI's preservation assessment (e.g., "this leather jacket has been fine in non-climate-controlled storage for 5 years; don't flag it"). → User can edit the preservation fields manually in the Detail overlay (severity, concerns, flags, instructions). The override is stored. Re-evaluation can clobber it; the user can re-edit.

- **EC9** AI evaluates an item identically twice but assigns different preservation risk levels. → Acceptable. The AI's judgment varies. The user can edit. Future spec might consider preservation history; out of scope here.

- **EC10** Backfill encounters an entry whose photo is no longer available (purged thumbnails, etc.). → Skip it. Log the entry ID. Don't error the batch. The user can manually populate preservation for that entry from the Detail overlay.

- **EC11** Two users edit the same item's preservation fields simultaneously. → Last-write-wins, like all other Cernita edits. Acceptable.

- **EC12** A plastic-bin-recommended item is sold or donated (decision changes from KEEP-ITALY to SELL). → The preservation flags stay (they describe the item, not the decision). They're harmless when the item isn't being kept. No special handling.

- **EC13** Item's `final_decision` is NEEDS-HUMAN. The AI couldn't decide. Should preservation analysis still run? → Yes. Preservation is independent of decision. The AI returns preservation fields regardless.

- **EC14** Preservation_risk = 'severe' but final_decision = KEEP-ITALY. The math says keep, but survival probability is low. → The decision stands (Principle 1, user owns the decision). The Detail overlay shows the severe warning. The user is informed.

- **EC15** Long packing_instructions text (e.g., 1000 characters of detailed advice). → Display fully in Detail overlay. Truncate to first sentence in Result card with "... Read more" tap.

## Out of scope

- **A static knowledge base of "how to pack X."** No internal database of "how to pack a guitar" / "how to pack a vinyl record." The AI generates per-item instructions when the photo and context warrant. Cernita is not a packing manual.

- **Specific brand recommendations for desiccants, plastic bins, or wrap.** No "buy these specific Tupperware totes" links. The user buys what they buy.

- **Preservation-driven cost adjustments.** The math doesn't currently factor "if this item costs $50 to ship and arrives 30% likely to be ruined, the expected value of shipping is $50 + (0.30 × $400 replacement) = $170." Adding probabilistic expected-value math is mathematically defensible but communicatively confusing for the user. v1 keeps the cost math simple and uses preservation_risk as a confidence signal in the rationale, not as a numeric multiplier. Future spec could add probabilistic math if useful.

- **Climate-controlled storage cost calculations.** The user's storage rate (currently default $0.25/cu ft/mo) is uniform. We don't model "if you pay $0.50/cu ft/mo for climate-controlled, the survival probability rises to 90%." Out of scope; user can negotiate with their storage provider.

- **Per-item insurance valuation reflecting preservation risk.** The future insurance manifest spec might do this. Not here.

- **Auto-purchase of packing supplies.** No "Cernita ordered desiccants for you" — just guidance.

- **Time-of-year packing concerns.** Summer vs winter pickup affects humidity. Not modeled. Out of scope.

- **A "preservation report" for the entire household.** No PDF summarizing every preservation concern. Future spec; the customs PDF will likely include preservation flags.

- **AI-driven re-evaluation when something changes (e.g., box material).** No automatic re-derivation when the user changes box materials. Manual workflow only. Future spec could trigger.

- **Tracking actual deterioration after the move.** No "the leather jacket arrived ruined, here's what we learned." That's a customer feedback / model improvement concern, not a moving app concern.

## Open questions

- **Q1:** Should the preservation flags be visible in the Quotes tab (when the user is comparing moving company quotes)?
  **A:** No, not in v1. The Quotes tab is for cost comparison of moving companies. Preservation is item-level, not move-level. Future spec might add a "preservation summary" to the Quotes view (e.g., "23% of items have moderate+ preservation risk"), but not v1.

- **Q2:** Should the AI be more cautious with old/vintage items (default to higher preservation_risk)?
  **A:** The AI's training likely already does this. The prompt examples include vintage items as examples of moderate-to-severe risk. Trust the model's judgment with the prompt as guidance.

- **Q3:** Should we track plastic bin reuse / sustainability concerns?
  **A:** No. Cernita is about a specific move, not lifecycle inventory. If the user wants to reuse plastic bins, they buy and reuse. The app doesn't track bin lifecycle.

- **Q4:** Should the user be able to mark an item "preservation-handled" (e.g., "this leather jacket has been treated, won't deteriorate")?
  **A:** Manual edit of the preservation fields handles this. The user can set preservation_risk = 'none' for any item at any time. No special "handled" state needed.

- **Q5:** Should the Bins tab "By location" view show preservation summaries per location?
  **A:** Useful but not v1. Adding "Galesburg storage: 3 humidity-sensitive items, 1 severe-risk item" as a summary line is a small extension that could be a follow-up. Out of scope here.

- **Q6:** Should the trip suitcase weight gauges have any preservation logic?
  **A:** No. Suitcase preservation is handled in the same way as other boxes — the suitcase is a kind of "box." If a humidity-sensitive item is in a checked bag going to a humid airport, that's a regular preservation concern, surfaced through the existing flags.

- **Q7:** When the user changes a packing instruction, should the AI's original be preserved as audit trail?
  **A:** Not v1. The user owns the data. If they edit the instruction, the new value replaces the old. Audit trail is feature-creep.

- **Q8:** Should re-derivation under new rules also re-evaluate preservation?
  **A:** No. Re-derivation is about the decision (KEEP/SELL/etc.) under updated cost rules. Preservation is item-physics, independent of cost rules. Re-evaluating preservation requires the AI; that's the explicit "Re-evaluate" backfill in Settings, not part of `deriveDecision`.

All open questions resolved.

## References

- **Constitution amendment 001** — adds Principle 13. This spec implements it.
- **Constitution Principles 2, 9, 11, 1** — bilingual, honest math, user owns decision, safety
- **Spec dependencies:** location-tracking (must ship first); bilingual item names + bilingual rationale (shipped)
- **Related concept:** `handling_warnings` field already in schema, populated by the AI for some preservation-adjacent flags (sharp, heavy, archival storage). This spec elevates that field's role and adds dedicated preservation fields beside it.

## Implementation notes

### Sequencing within this spec

Three commits, individually testable:

1. `feat(schema): preservation columns, migration 2h, default values` — pure data model. Backward compatible. Existing entries get sensible defaults.

2. `feat(prompt): preservation-aware AI evaluation, decision rationale changes` — the AI prompt update, bilingual examples, JSON schema extension, save-flow extension. Decision logic in `deriveDecision()` is updated to include preservation in the rationale text.

3. `feat(ui): packing guidance UI, box material, warnings, Settings backfill, CSV export` — the user-visible layer. Box material selector, Detail overlay packing guidance section, Result card display, Log/Bins icons, the override warning flow, the Settings backfill.

### AI prompt update (sketch)

The existing system prompt has a section like "═══ N. HANDLING WARNINGS ═══". The new prompt section is:

```
═══ N+1. PRESERVATION ANALYSIS (Constitution Principle 13) ═══

Every item must be evaluated for deterioration risk in storage and transit.
Return:
- preservation_risk: "none" | "low" | "moderate" | "high" | "severe"
- preservation_concerns: bilingual short note about what threatens the item
- needs_plastic_bin, needs_plastic_wrap, needs_ziplock, needs_desiccant: booleans
- packing_instructions: bilingual specific guidance (when risk >= moderate)

Categories of risk:
HUMIDITY/TEMPERATURE: wood, leather, books, paper, photos, vinyl, foam,
  rubber, electronics, instruments, fabric (esp. natural fibers), oil paintings
PESTS: wool, silk, food residue, books, untreated wood
SHOCK: glass, ceramics, fragile electronics, items with liquid, framed art
CHEMICAL: foam mattresses, rubber, adhesives, old electronics with capacitors,
  batteries

Examples:

[Vintage leather jacket, photo shows wear and patina]
preservation_risk: "high"
preservation_concerns: "humidity-sensitive, pest-vulnerable (wool lining)"
preservation_concerns_it: "sensibile all'umidità, vulnerabile agli insetti (fodera in lana)"
needs_plastic_bin: true
needs_desiccant: true
packing_instructions: "Wrap in acid-free tissue, place in plastic bin with
  cedar block and desiccant. Avoid direct contact with other leather items."
packing_instructions_it: "Avvolgere in carta velina senza acidi, mettere in
  contenitore di plastica con blocco di cedro ed essiccante. Evitare contatto
  diretto con altri articoli in pelle."

[Cast iron skillet, well-seasoned]
preservation_risk: "moderate"
preservation_concerns: "rust risk in humid storage"
preservation_concerns_it: "rischio di ruggine in deposito umido"
needs_plastic_wrap: true
needs_desiccant: true
packing_instructions: "Re-oil thoroughly, wrap in plastic film, place in
  plastic bin with desiccant. Do not stack other items on top."
packing_instructions_it: "Oliare nuovamente, avvolgere in pellicola, mettere
  in contenitore di plastica con essiccante. Non impilare altri oggetti sopra."

[Coffee mug, contemporary]
preservation_risk: "none"
preservation_concerns: ""
needs_plastic_bin: false
needs_plastic_wrap: false
needs_ziplock: false
needs_desiccant: false
packing_instructions: ""

[1950s reel-to-reel tape recorder]
preservation_risk: "severe"
preservation_concerns: "old electrolytic capacitors will likely fail; magnetic
  heads sensitive to humidity"
preservation_concerns_it: "vecchi condensatori elettrolitici probabilmente
  guasti; testine magnetiche sensibili all'umidità"
needs_plastic_bin: true
needs_desiccant: true
packing_instructions: "Original storage in plastic bin with multiple desiccant
  packs. Consider whether to have a technician evaluate before shipping;
  may not survive the journey functionally."
packing_instructions_it: "Conservare in contenitore di plastica con più
  pacchetti essiccanti. Considerare la valutazione di un tecnico prima della
  spedizione; potrebbe non sopravvivere funzionalmente al viaggio."
```

The prompt also instructs: "Reflect preservation risk in the `rationale` text when risk is moderate or higher. Reduce `confidence` for items with high preservation risk."

### `deriveDecision()` changes

Existing function returns `{ decision, reason, reason_en, reason_it }`. Update to append preservation note when `preservation_risk` >= 'high':

```javascript
function deriveDecision(facts, rules) {
  const baseResult = /* existing logic */;
  
  // Add preservation note if relevant
  if (facts.preservation_risk === 'high' || facts.preservation_risk === 'severe') {
    const concerns = facts.preservation_concerns || 'preservation concerns';
    const concernsIt = facts.preservation_concerns_it || 'problemi di conservazione';
    return {
      ...baseResult,
      reason_en: `${baseResult.reason_en} (${facts.preservation_risk} preservation risk: ${concerns})`,
      reason_it: `${baseResult.reason_it} (rischio conservazione ${facts.preservation_risk}: ${concernsIt})`,
      reason: baseResult.reason + ` (${facts.preservation_risk} preservation risk)`
    };
  }
  
  return baseResult;
}
```

The decision itself doesn't change. Only the reason becomes more honest.

### Backfill function

Same pattern as bilingual backfills. New function `runPreservationBackfill()`:

1. Find entries where `preservation_risk` is null or 'none' AND created before the migration date.
2. For each, send the photo and item name to the AI with a focused prompt: "Re-evaluate this item for preservation risk only. Return the preservation fields. Don't re-do the cost math."
3. Update the entry with the response. Log failures. Standard progress UI.

Cost: ~$0.005 per item (more expensive than name-translation backfills because it sends the photo). For ~500 items, ~$2.50.

### Box material UI

Box creation form gets a new section:
```html
<label>Material · Materiale</label>
<select id="box-material">
  <option value="cardboard">📦 Cardboard · Cartone (default)</option>
  <option value="plastic">🪣 Plastic bin · Contenitore di plastica</option>
  <option value="crate">🪵 Crate · Cassa di legno</option>
  <option value="other">⬚ Other · Altro</option>
</select>
```

Per the location-tracking spec, default location is the user's last-used. We can extend that to remember last-used material per session.

### CSS additions

- Preservation risk badge styles (5 levels, mapping to existing color tokens)
- Box material icons (4 variants, small inline before box number)
- Packing guidance section style (similar to existing Italian rationale block — bordered, italic, padding)
- Override warning indicator on box cards (small ⚠ with the existing notification chip styling)

### Migration testing

Manual checklist before merging:
- Fresh install: works
- Existing user runs migration 2h: works without losing existing data
- Creating an item, AI returns preservation fields, entry saves correctly: works
- Creating a plastic vs cardboard box, distinct visual: works
- Adding plastic-bin-required item to cardboard box, warning appears: works
- Override flow records the override and shows the indicator: works
- Backfill in Settings populates older entries: works
- Editing preservation fields in Detail overlay: works
- CSV export includes new columns: works
- Two phones see same preservation data (Supabase sync): works
