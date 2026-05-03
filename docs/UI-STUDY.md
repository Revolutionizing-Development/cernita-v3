# UI study: Cernita vs. category leaders

> A research-backed comparison of Cernita's interface against the apps people actually use to track moves and inventory, with prioritized recommendations for what (if anything) to change before the backend proxy work begins.

Drafted 2026-04-27 · For internal review · Not a spec, not a commitment to implement

---

## Why this study exists

Before implementing the backend proxy spec, we paused to ask: **does the current frontend have UX gaps that should be addressed first?** Building security infrastructure on top of a frontend that needs significant rework would mean retesting and potentially redoing security-critical paths. The right sequence is: validate the UI, fix what's worth fixing, then build the backend.

This study compares Cernita to the apps people actually use for similar work, identifies real gaps, and recommends what to do before, during, and after the backend proxy ships.

---

## The category and its leaders

**Cernita's category:** photo-based home inventory for relocation. Users photograph belongings, get categorization help, track packing decisions, and produce records for shipping, customs, and insurance.

**Category leaders identified:**

- **Sortly** — clear category leader. Visual inventory system that allows users to photograph and categorize belongings, with up to eight photos per item, making it easier to track belongings and locate them later. Snap pictures of items, categorize them, and even generate QR labels. Mobile-first, used by 20,000+ businesses.
- **MoveAdvisor** — free room-by-room home inventory plus a week-by-week moving timeline and a directory to compare movers. Less visual, more planning-focused.
- **MagicPlan, Encircle, Magic Home Inventory** — secondary players, similar feature set.
- **General inventory apps** (UXPin, Uizard templates) — informative for design patterns but built for retail/warehouse, not personal moves.

**Sortly is the comparison standard.** It's the most polished, most-used, and closest in purpose to Cernita.

---

## Feature comparison

| Feature | Cernita | Sortly | Worth changing? |
|---|---|---|---|
| **Photo-first capture** | ✓ | ✓ | Already aligned |
| **Multiple photos per item** | ✗ (1 photo) | ✓ (up to 8) | Maybe — see analysis below |
| **AI evaluation of items** | ✓ (unique to Cernita) | ✗ | Cernita's differentiator |
| **Bilingual output** | ✓ (unique to Cernita) | ✗ | Cernita's differentiator |
| **QR code generation for boxes** | ✗ | ✓ | Yes — high value, on roadmap |
| **Barcode scanning** | ✗ | ✓ | Probably not — wrong fit for pruning workflow |
| **Folders / hierarchical organization** | partial (bins) | ✓ (nested folders) | Maybe — bins are flat today |
| **Search** | ✗ | ✓ | Yes — significant gap |
| **Tags / custom fields** | partial (flags) | ✓ | Probably already adequate |
| **Offline mode** | partial (PWA cache) | ✓ | Already aligned |
| **Multi-device sync** | ✓ (Supabase) | ✓ | Already aligned |
| **Export to CSV/PDF** | ✓ (CSV) | ✓ (CSV + PDF) | PDF needed for customs anyway |
| **Per-room organization** | ✗ (per-decision) | ✓ | Worth considering |
| **Dashboard / overview** | partial (savings card) | ✓ | Already partially aligned |
| **Insurance/value tracking** | ✓ (resale value) | ✓ | Aligned |
| **Cost calculations** | ✓ (unique depth) | ✗ | Cernita's differentiator |
| **Shared inventory views** | ✓ | ✓ | Aligned |

---

## Where Cernita is genuinely ahead

Three things Cernita does that Sortly doesn't:

1. **AI-driven decision support.** Sortly is a passive ledger — you tell it what you have. Cernita actively helps you decide what to keep, sell, donate, ship, or carry. This is the entire point of Cernita and where it earns its existence.

2. **Honest economic math.** Net cost framing (replace − resale vs. storage + ship vs. carry-bag), with the math shown to the user. Sortly tracks values but doesn't compute trade-offs. Sortly's photographic inventory is recommended specifically "for those moving high-value antiques or electronics" — it's a record-keeping tool, not a decision tool.

3. **Bilingual output for international moves.** Sortly is English-only. For moves crossing language boundaries (which is increasingly common), the bilingual record is a genuinely meaningful differentiator. Already shipped in Cernita.

These are real strengths and shouldn't be diluted.

---

## Where Cernita has real gaps

Five gaps worth honest acknowledgment:

### Gap 1 — Search (significant)

Cernita has no search. To find an item you've evaluated, you scroll the Log or filter by destination. With 50 items this works. With 500 items (realistic for a full house), it doesn't.

Sortly's search is one of the features users praise most: type "lamp" and find every lamp instantly. As Cernita's Log grows, the absence of search will become a daily friction point.

**Severity:** medium-high. Doesn't block usage, but degrades quality of life as the inventory grows.

### Gap 2 — Single photo per item (moderate)

Cernita captures one photo. Sortly allows up to eight. For most items one is fine. For complex items — a piece of furniture you want to show from multiple angles, a box you want both an exterior and interior shot of, an item with a serial number you want photographed alongside the item itself — one is limiting.

This particularly matters for **high-value items going through customs**. The customs broker often wants multiple angles to verify condition, value, and identity.

**Severity:** medium. Particularly relevant given Constitution Principle 12 (compliance with destination requirements).

### Gap 3 — No room/location organization yet (moderate)

Cernita organizes by *destination* (KEEP-ITALY, KEEP-TEXAS, SELL, etc.) but not by *current location* (kitchen, garage, bedroom). Both Sortly and MoveAdvisor organize by room as a primary axis.

This is a real workflow issue. When packing the kitchen, you want to see "all kitchen items" — currently in Cernita that's a manual filter. The user has already requested this feature (the location tracking question we discussed but haven't speced yet).

**Severity:** medium. Already on the roadmap as the location-tracking spec.

### Gap 4 — No QR code generation (low for now, high later)

Sortly generates printable QR labels you stick on boxes. Scan a label, see contents instantly. This is genuinely useful at the destination — you arrive in Italy with 40 boxes and need to find the kitchen knives.

Cernita doesn't have this. It's a real feature gap for the "after the move" phase. Less important during the saving sprint and packing, very important during unpacking.

**Severity:** low for now (we're in the pre-packing phase), high later (separate spec needed before final move).

### Gap 5 — No PDF export (medium, customs-relevant)

Cernita exports CSV. Sortly exports CSV + PDF. For customs documentation specifically, PDF is the expected format. Sortly users export "custom PDF or CSV reports" perfect for "audits, budgeting, and forecasting".

Cernita's customs declaration spec (queued, not yet drafted) will need to address this. So this gap closes when we ship that spec — it's not a separate problem.

**Severity:** medium, but already accounted for in the roadmap.

---

## Where Cernita's UI is comparable or better

Three areas where Cernita actually holds up well:

### Visual design and aesthetic

Cernita's Italian editorial aesthetic — Cormorant Garamond serif, terracotta + olive palette, Cormorant italics for accent — is genuinely more thoughtful than Sortly's design. Sortly is functional but generic; Cernita has personality.

This isn't just vanity. Apps that feel made get used more. Inventory app design guidance specifically calls out: "consistency not only looks professional but also helps users learn the interface more quickly". Cernita's consistency is high.

### Motion and transitions

The motion system added in earlier passes (count-up animations, staggered card reveals, spring-back on tap, haptic feedback) is more polished than Sortly's. Sortly is utilitarian; Cernita feels intentional.

### Honest math display

The "Net cost of each path" table — showing SHIP / SELL / CARRY net costs side-by-side with the winner highlighted — is unique. Nothing in Sortly or MoveAdvisor does this. It's the visual expression of Constitution Principle 2 (honest math, always shown).

---

## Where Cernita's UI has minor friction (not gaps, just sharpness opportunities)

Walking through the app with the comparison apps in mind, three minor points:

### 1. The Evaluate tab's first impression isn't strong enough

When the app opens cold (no recent evaluation), the user sees: a setup banner (if applicable), the bilingual tagline, two buttons (Take photo / From library), and an evaluate button. It's correct but quiet.

Sortly opens to a dashboard with quick stats and recent activity — a "you're using the app" feeling. Cernita opens to "do something." Slightly more inviting first impressions are achievable without compromising the focused workflow.

**Possible improvement:** show a small recent-activity preview on the Evaluate tab when there are entries. *"Last evaluated: Bauhaus dresser → KEEP-ITALY · 2 hours ago"*. Or a "today's stats" line: *"3 items today · $240 in saved decisions"*. Optional touch, not critical.

### 2. The Log and Bins tabs feel similar in scan-pattern

Both are lists of items with thumbnails. They serve different purposes (Log = chronological history, Bins = packing organization) but a casual user might not immediately understand the distinction.

Sortly differentiates more clearly: a top-level dashboard, then folder navigation, then item lists. Cernita's tab labels are clear ("Log" vs "Bins") but the content layout could differentiate further.

**Possible improvement:** the Bins tab could lean harder into its packing-organization purpose with a stronger visual treatment (per-bin cards already do this, but could be more bold). Low priority.

### 3. No search box at the top of Log

Already covered as Gap 1. Worth restating that the most visible UI gap, when comparing tab-by-tab to Sortly, is the absence of a search bar at the top of the Log view.

---

## Recommended priority

Rank-ordered from highest to lowest impact-per-effort:

### Now (before backend proxy ships)

**Nothing critical to change.** The frontend is in good shape for the user model. The backend proxy is the right next thing.

The only minor thing I'd argue for is: **add a search bar to the Log view** as a small Tier 2 spec before the backend work. Reasoning: it's a real gap, it's small (~30 lines of code), and adding it after backend changes means re-testing both the search and the proxy auth at the same time.

### During backend proxy implementation (no extra UI work)

Backend proxy is fundamentally invisible to the user. Settings UI changes from "API key fields" to "Worker URL + Household password," but that's covered by the spec.

Don't pile on UI changes during this. Keep the change focused.

### After backend proxy ships

In rough priority order:

1. **Multi-photo per item (Tier 2)** — addresses Gap 2. Important for customs documentation. Schema change: `photos jsonb` array instead of single `thumb` text. Real but bounded work.

2. **Location tracking (Tier 3, already discussed)** — addresses Gap 3. The user already asked for this. The spec questions raised earlier are unanswered; once you answer them I'll draft the spec.

3. **Search in Log (Tier 2)** — addresses Gap 1, if not done before backend proxy. Could be done at the same time as multi-photo since both touch the Log/Bins views.

4. **Customs PDF export (Tier 3)** — addresses Gap 5 and Constitution Principle 12. Bigger spec because it involves PDF generation, Modello 4 form layout, bilingual output. High strategic value (justifies all the bilingual work we've done).

5. **QR code generation for boxes (Tier 2)** — addresses Gap 4. Most useful at destination, so can wait until late in the project.

---

## What I'm specifically *not* recommending

Things that came up in the research but I don't think Cernita should adopt:

**Don't adopt Sortly's nested folder paradigm.** Sortly uses arbitrarily nested folders (Kitchen → Drawer 1 → Utensils). For business inventory with thousands of items, this scales. For a household move with hundreds, it's overkill and adds cognitive load. Cernita's flat-bin organization is right for the use case.

**Don't add barcode scanning.** Sortly's barcode scanner is for stocked items with retail barcodes. Cernita's user is photographing personal belongings — most don't have barcodes, and the AI evaluation does the identification job barcodes do for retail. Adding barcode scanning would dilute the photo-first AI-evaluation flow.

**Don't add stock alerts.** Cernita isn't tracking ongoing stock — it's tracking a one-time relocation inventory. Restock alerts make no sense for items being shipped to Italy.

**Don't add a pricing tier model.** Sortly's complaint thread is dominated by users frustrated with the freemium model and item limits. Cernita is a personal tool, not SaaS. This isn't a temptation we need to resist explicitly, but worth noting that "make it more like Sortly" should not include "make it monetizable."

**Don't add a "moving timeline" feature.** MoveAdvisor's week-by-week timeline is valuable for general moves. For your specific situation (Galesburg → Lubbock → Italy with concrete known dates), the timeline is in your head and your calendar. Adding a generic timeline UI would be feature-creep.

---

## Summary recommendation

**Proceed with the backend proxy spec implementation as planned.** The frontend is in genuinely good shape — better than I expected when starting this study. The areas where Cernita falls behind Sortly (search, multi-photo, QR codes) are real but addressable in subsequent specs. The areas where Cernita is ahead (AI evaluation, honest math, bilingual output, intentional design) are meaningful and shouldn't be diluted.

If you want to add one small thing to the immediate backlog: **a search bar on the Log view** as a small Tier 2 spec. ~30 lines of code, addresses the most-noticeable gap when you put Cernita next to Sortly side-by-side. But this is optional — it can wait until after the backend ships if you'd rather not parallelize.

Everything else worth changing is either already on the roadmap (location tracking, customs PDF, multi-photo) or is rightly out of scope for Cernita's category and use case.

---

## What this study deliberately doesn't cover

- **Visual design audit** — color choices, typography sizing, micro-interactions. Cernita's design is good and not in question.
- **Performance benchmarks** — we'd need actual usage data on real phones with realistic inventories. Worth doing once the app has real usage but premature now.
- **Accessibility audit** — important and overdue, but a separate dedicated effort. Cernita uses semantic HTML and has decent contrast, but a real WCAG audit is its own spec.
- **Internationalization beyond bilingual** — adding more languages, RTL support, locale-aware date/currency formatting. Out of scope for current user needs.
- **Native iOS/Android apps** — would require fundamental architecture change. Constitution Principle 7 allows it, but no current pressure to do so.

---

## Sources reviewed

In rough order of usefulness:

- **Sortly** (App Store, Google Play, sortly.com) — primary comparison
- **MoveAdvisor** (moveadvisor.com, Amazon Appstore) — secondary comparison
- **MovingPlace's "Best Moving Apps"** roundup (Feb 2026) — category overview
- **Burly Boyz Moving's "Moving Inventory List"** (Feb 2026) — practical user guidance
- **Cali Moving's app comparison** — secondary roundup
- **UXPin and similar** — generic inventory UI design guidance (less applicable)

The category is well-documented; Cernita's positioning relative to the leaders is clear.
