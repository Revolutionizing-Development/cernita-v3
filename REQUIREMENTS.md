# Cernita — Requirements & Project State
**For lead engineer onboarding · Last updated May 2026**

> Cernita is a moving inventory and decision-support tool for an international move:
> Galesburg, Illinois → Lubbock, Texas → a stone farmhouse near Todi, Umbria, Italy.
> Two users (a couple) on mobile phones evaluate ~500–1,000 belongings and decide
> what to keep, ship, store, sell, donate, give away, or dispose of — with honest
> economic math and bilingual (EN/IT) output throughout.

The **Constitution** (`/.specify/memory/constitution.md`) encodes 13 non-negotiable
principles. Read it before touching the codebase. This document does not repeat it —
it references it.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (Pages Router) | No App Router. No Tailwind. CSS custom properties only. |
| Language | TypeScript (strict) | All pages, components, lib |
| Hosting | Vercel | Serverless functions for API routes |
| Database | Supabase (PostgreSQL) | RLS enabled; Realtime for two-phone sync |
| Auth | Supabase Auth | Email/password; `AuthGuard` component wraps every page |
| AI | Anthropic Claude (via `/api/anthropic`) | Model configurable in Settings |
| Fonts | Cormorant Garamond (serif) + Lato (sans) | Google Fonts, loaded in `_document.tsx` |
| State | React `useReducer` + Context (`lib/context.ts`) | Global: entries, boxes, trips, locations, settings, user |
| Realtime | Supabase Realtime channels | All four tables subscribed; two-phone sync is live |
| CSS | `styles/globals.css` (single file, ~3,200 lines) | All design tokens in `:root`; motion gated behind `.motion-enabled` |

---

## Directory structure

```
pages/
  index.tsx              → redirect to /dashboard
  dashboard.tsx          → Overview (landing tab)
  evaluate.tsx           → Camera → AI → Result → Save flow
  log.tsx                → Searchable/filterable item log
  bins.tsx               → Box management (plastic boxes + suitcases)
  trips.tsx              → Travel event management, suitcase manifest
  settings.tsx           → All user-configurable settings
  discuss.tsx            → ⚠ STUB — see Outstanding below
  distinta.tsx           → Italian customs declaration (print-to-PDF)
  manifest/[id].tsx      → Per-box printable packing list
  export/inventory.tsx   → Full inventory with photos (print-to-PDF)
  login.tsx              → Auth page
  api/
    anthropic.ts         → AI evaluation proxy (keeps API key server-side)
    health.ts            → Health check endpoint

components/
  AuthGuard.tsx          → Redirects unauthenticated users to /login
  Nav.tsx                → Bottom navigation bar (6 tabs)
  SyncIndicator.tsx      → Online / syncing / offline status dot

lib/
  context.ts             → AppProvider, useApp, reducer, Realtime subscriptions
  types.ts               → Entry, Box, Trip, Location, CernitaSettings, Decision
  supabase.ts            → Supabase client (browser-side)
  exportCsv.ts           → CSV export utility
  haptic.ts              → Vibration feedback utility (5 presets)
  useCountUp.ts          → RAF-based count-up animation hook

styles/
  globals.css            → All CSS. Tokens → layout → components → animations

.specify/
  memory/constitution.md → 13 non-negotiable principles (read this first)
  specs/NNN-feature/     → Formal feature specifications
```

---

## Database schema

### `cernita_entries` — evaluated items
| Column | Type | Notes |
|---|---|---|
| `id` | int8 (PK) | auto |
| `user_name` | text | display name of evaluator |
| `item_name` | text | English name (AI-generated) |
| `item_name_it` | text | Italian name (AI-generated) |
| `item_model` | text | Brand + model identified from photo |
| `final_decision` | text | One of the 7 Decision values |
| `user_confirmed` | bool | true once user accepts or overrides |
| `override_reason` | text | Set when user disagrees with AI |
| `estimated_resale_value` | numeric | USD |
| `replacement_cost` | numeric | USD |
| `weight_lb` | numeric | |
| `volume_cuft` | numeric | |
| `storage_cost_total` | numeric | Computed from rules |
| `ship_cost` | numeric | Computed from rules |
| `net_cost_ship` | numeric | replace − resale − ship |
| `net_cost_storage` | numeric | replace − resale − storage |
| `recommendation_rationale` | text | English rationale |
| `recommendation_rationale_it` | text | Italian rationale |
| `confidence` | text | high / medium / low |
| `fragility` | text | none / low / medium / high / irreplaceable |
| `survival_risk` | text | English preservation warning |
| `survival_risk_it` | text | Italian preservation warning |
| `packing_notes` | text | English packing guidance |
| `packing_notes_it` | text | Italian packing guidance |
| `shipping_restriction` | text | none / restricted / prohibited |
| `shipping_restriction_note` | text | English hazmat note |
| `shipping_restriction_note_it` | text | Italian hazmat note |
| `oversized` | bool | True if item can't fit in a 27-gal box |
| `photo_data` | text | JPEG base64, compressed to ~200 KB |
| `box_id` | int8 (FK) | Which box this item is packed into |
| `current_location_id` | int8 (FK) | Physical location |
| `bin_id` | text | Legacy; unused in rebuild |
| `rules_version` | text | e.g. "1.0.3" — snapshot of rules at eval time |
| `rules_snapshot` | jsonb | Full settings snapshot at eval time |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `cernita_boxes` — physical containers
| Column | Type | Notes |
|---|---|---|
| `id` | int8 (PK) | |
| `box_number` | text | e.g. "B-01", "S-01" |
| `destination` | text | Decision value: where this box is headed |
| `box_type` | text | `'plastic'` or `'suitcase'` |
| `current_location_id` | int8 (FK) | |
| `storage_requirement` | text | climate_controlled / standard / garage_ok |
| `notes` / `notes_it` | text | Bilingual notes |
| `closed_at` | timestamptz | Non-null = sealed |
| `trip_id` | int8 (FK) | Suitcases only |
| `suitcase_class` | text | checked / carry_on / personal_item |
| `weight_limit_lb` | numeric | Suitcases only |
| `created_at` | timestamptz | |

### `cernita_locations` — physical places
| Column | Type | Notes |
|---|---|---|
| `id` | int8 (PK) | |
| `name` / `name_it` | text | Bilingual |
| `is_default` | bool | |
| `sort_order` | int | |
| `created_at` | timestamptz | |

### `cernita_trips` — planned travel events
| Column | Type | Notes |
|---|---|---|
| `id` | int8 (PK) | |
| `name` / `name_it` | text | Bilingual |
| `traveler_name` | text | |
| `origin_location_id` / `destination_location_id` | int8 (FK) | |
| `departure_date` / `return_date` | date | |
| `status` | text | planned / packing / executed / canceled |
| `executed_at` | timestamptz | Set when trip is executed |
| `notes` / `notes_it` | text | Bilingual |
| `created_at` | timestamptz | |

---

## Decisions (the 7 possible outcomes)

| Value | English | Italian |
|---|---|---|
| `KEEP-ITALY` | Keep — ship to Italy | Porta in Italia |
| `KEEP-US` | Keep — move to [city] | Porta a [città] |
| `SELL` | Sell | Vendi |
| `DONATE` | Donate | Dona |
| `DISPOSE` | Dispose | Smaltisci |
| `GIVE-FAMILY` | Give to family | Dai alla famiglia |
| `NEEDS-HUMAN` | Needs discussion | Richiede discussione |

---

## Settings (stored in localStorage, persisted per user)

All settings live in `CernitaSettings` (`lib/types.ts`). Key ones:

| Setting | Default | Purpose |
|---|---|---|
| `usDestination` | "Colorado Springs" | Intermediate US city label |
| `storageRatePerCuFt` | $2.50 | Cost math |
| `monthsInStorage` | 18 | Cost math |
| `shippingRatePerLb` | $0.75 | Cost math |
| `shippingRatePerCuFt` | $4.00 | Cost math |
| `weightSoftThresholdLb` | 50 | Box weight warning |
| `weightHardThresholdLb` | 70 | Box weight hard limit |
| `checkedBagLimitLb` | 50 | Suitcase defaults |
| `carryOnLimitLb` | 22 | Suitcase defaults |
| `personalItemLimitLb` | 16 | Suitcase defaults |
| `aiModel` | claude-sonnet-4-5 | Swappable in Settings |
| `eurRate` | 0.92 | EUR/USD for customs distinta |
| `motionEnabled` | true | Feature flag: all animations off when false |
| `rulesVersion` | "1.0.0" | Bumped when rates change; marks entries outdated |

---

## What has been shipped

### Formally specced (specs 001–014)
- **001** Bilingual item names — AI returns EN + IT item name
- **002** Bilingual rationale — AI returns EN + IT rationale paragraphs
- **003 / 009** Backend proxy + Supabase auth — login, AuthGuard, session
- **004 / 010** Vercel deployment + stack — Next.js 14, AppContext, Realtime
- **005** Log search — search bar + filter pills (decision, outdated, unboxed)
- **006** Location tracking — locations table, box/item location picker, LocationsManager
- **007** Trips & suitcases — Trips page, suitcase manifest, weight gauges, execute/lock
- **008** Preservation — fragility, survival_risk, packing_notes in AI output and UI
- **011** Core evaluation — camera capture, AI evaluation, result card, override, save
- **012** CSV export — full data export in Log header and Settings
- **013** Log tab — filterable log, detail overlay, box/location assignment
- **014** Settings tab — rates, AI model, bag limits, LocationsManager

### Shipped without formal specs ⚠ (specs must still be written — Constitution P10)
- **Unboxed item labelling** — `◻ Unboxed` filter pill; location picker on loose items
- **Shipping restrictions / hazmat** — AI flags prohibited/restricted items; 🚫/⚠️ badges
- **Storage requirements** — boxes get climate_controlled/standard/garage_ok label
- **Item model identification** — AI identifies brand + model from photo for pricing
- **Oversized items** — AI flags items too large for a 27-gal box; `◱` badge; box assignment blocked
- **Destination enforcement** — SELL/DONATE/DISPOSE blocked from box assignment; KEEP-ITALY sees only KEEP-ITALY boxes; GIVE-FAMILY sees only suitcases
- **Dashboard / overview** — landing page with count-up stats, decision bar, action alerts, cost summary
- **Box manifests** — printable per-box packing list at `/manifest/[id]`
- **Inventory PDF export** — full inventory with photos, grouped by decision (`/export/inventory`)
- **Italian customs distinta** — official D.P.R. 43/1973 declaration at `/distinta`
- **Motion & animations** — feature-flagged: staggered lists, spring-back, phase transitions, weight bar, haptics; toggled in Settings

### Pending migrations (run these on your Supabase project)
- `docs/migration-010-plastic-boxes.sql` — renames box_type 'cardboard' → 'plastic'
- `docs/migration-011-oversized.sql` — adds `oversized boolean` column to entries

---

## What is outstanding

### 1. Discuss tab — stub only *(Constitution P4: structural, not optional)*
`/discuss` exists as a page but shows only an empty state. Its purpose is to surface items where the two users disagree — i.e. `NEEDS-HUMAN` items that need a conversation. There is no mechanism to flag a disagreement, log a discussion, or resolve one. This is required by the constitution ("Disagreements are surfaced, not hidden — the Discuss tab is structural, not optional").

**Scope:** Items with `final_decision = 'NEEDS-HUMAN'` should appear here. The tab needs: a list of disputed items, a way for each user to record their position, a resolution action (changes the decision), and ideally a simple in-app comment thread. Real-time sync already works.

---

### 2. Bulk re-derive — button is a no-op
The "Re-derive outdated entries" button in Settings currently just displays a toast directing users to review each outdated item individually in the Log. The actual bulk re-computation (applying current rates to all outdated entries and writing back to Supabase) is not implemented.

**Scope:** For each entry where `rules_version ≠ settings.rulesVersion`, re-compute `storage_cost_total`, `ship_cost`, `net_cost_ship`, `net_cost_storage` using current rates (local math, no AI). Write updates to Supabase. Preserve `user_confirmed = true` overrides. Show progress and final count.

---

### 3. Box label printing *(Constitution P11: bilingual permanent records)*
Physical boxes need printed labels showing the box number, destination, contents summary, and storage requirement — in both English and Italian. There is no label generation page. The manifest page exists (per-box packing list) but is not the same as a compact physical label.

**Scope:** A `/labels` page or a label view inside the Bins overlay that generates one print-optimized label per box, sized for standard Avery 5163 or similar. Bilingual. Barcode optional.

---

### 4. Data deletion *(Constitution P3)*
The constitution states: "The user can request full data deletion and Cernita stops working — this is correct." There is currently no delete-my-data flow. Sign Out removes the session; it does not delete entries, boxes, trips, or the Supabase Auth user.

**Scope:** A Settings action (behind a confirmation dialog) that deletes all `cernita_entries`, `cernita_boxes`, `cernita_locations`, and `cernita_trips` rows for the current user, then deletes the Auth user record, then redirects to the login page.

---

### 5. Specs for 11 shipped features *(Constitution P10: specs over code)*
The following features shipped without formal specifications. The constitution requires a spec before implementation; these are retroactive but still required so behavior is documented, testable, and maintainable:

1. Unboxed item labelling
2. Shipping restrictions / hazmat
3. Storage requirements (box climate labels)
4. Item model identification
5. Oversized items
6. Destination enforcement (box assignment filtering)
7. Dashboard / overview page
8. Box manifests (`/manifest/[id]`)
9. Inventory PDF export (`/export/inventory`)
10. Italian customs distinta (`/distinta`)
11. Motion & animations (Tier 3)

**Scope:** Write `spec.md` for each in `.specify/specs/NNN-feature/`. Use the existing 001–014 specs as templates.

---

### 6. Moving company & insurance formats *(Constitution P12)*
The constitution requires outputs for insurance manifests and moving company inventories to "conform to those entities' actual format requirements." The current inventory export and distinta are good starting points but are not format-matched to a specific carrier or insurer.

**Scope:** Identify the actual carrier (ocean container company) and insurer. Obtain their required formats. Build targeted export pages (or extend existing ones) to match. Store authoritative format references in `.specify/specs/standards/`.

---

### 7. NEEDS-HUMAN → Discuss routing
Items flagged `NEEDS-HUMAN` by the AI appear in the Log with the correct badge but nothing routes them to the Discuss tab or prompts a conversation. This is related to item 1 above but specifically about the entry point: after an item is evaluated as NEEDS-HUMAN, the saved-state flow should offer a "Go to Discuss" action rather than asking about boxes.

---

## Key constraints for new engineers

1. **No Tailwind, no component library.** All CSS is in `styles/globals.css` with custom properties. Adding a UI library would violate Constitution P6.
2. **No App Router.** This is Pages Router. `getServerSideProps` / `getStaticProps` only.
3. **All AI calls go through `/api/anthropic`.** Never call Anthropic directly from the browser. The API key lives in Vercel environment variables only.
4. **Settings are localStorage, not a database table.** `AppContext` persists settings to `localStorage` on every dispatch. There is no `cernita_settings` table.
5. **Two-phone Realtime sync is live.** `AppContext` subscribes to all four tables. Any write to Supabase triggers a real-time update on both phones. Do not bypass this with optimistic updates that don't eventually write to Supabase.
6. **Every user-facing permanent record must be bilingual.** (Constitution P11.) If you add a field that appears in a manifest, export, or customs document, it needs both an English and Italian version.
7. **Animation CSS is gated behind `.motion-enabled` on `<body>`.** `MotionGate` in `_app.tsx` controls this based on `settings.motionEnabled`. Adding new animations: use `.motion-enabled .your-class` selectors only.
8. **The distinta uses `settings.eurRate`.** Update the rate in Settings before generating the Italian customs document. The default (0.92) is not guaranteed to be current.

---

## Environment variables (Vercel)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser-safe) |
| `ANTHROPIC_API_KEY` | Claude API key (server-side only) |

---

## Running locally

```bash
npm install
# Create .env.local with the three variables above
npm run dev       # http://localhost:3000
npm run build     # Production build check
npm run lint      # ESLint
```

The app requires HTTPS for camera access. In local development, `localhost` is treated
as secure by most browsers. For testing on a phone over the local network, use a tool
like `ngrok` or Vercel preview deployments.

---

## Reference

- Constitution: `.specify/memory/constitution.md`
- Feature specs: `.specify/specs/NNN-feature/spec.md`
- Pending migrations: `docs/migration-010-plastic-boxes.sql`, `docs/migration-011-oversized.sql`
- Design system: `:root` tokens in `styles/globals.css` (lines 1–18)
- AI prompt: `pages/api/anthropic.ts` — full prompt and JSON schema
