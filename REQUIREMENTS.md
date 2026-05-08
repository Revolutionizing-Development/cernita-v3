# Cernita — Requirements & Project State
**For lead engineer onboarding · Last updated May 7, 2026**

> Cernita is a moving inventory and decision-support tool for an international move:
> Galesburg, Illinois → Colorado Springs, Colorado → a stone farmhouse near Todi, Umbria, Italy.
> Two users (a couple) on mobile phones evaluate ~500–1,000 belongings and decide
> what to ship, sell, donate, give away, consume, or dispose of — with honest
> economic math, dual-perspective evaluation, and bilingual (EN/IT) output throughout.

The **Constitution** (`/.specify/memory/constitution.md`) encodes 14 non-negotiable
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
| State | React `useReducer` + Context (`lib/context.tsx`) | Global: entries, boxes, trips, locations, settings, user |
| Realtime | Supabase Realtime channels | All four tables subscribed; two-phone sync is live |
| CSS | `styles/globals.css` (single file, ~5,000 lines) | All design tokens in `:root`; motion gated behind `.motion-enabled` |

---

## Directory structure

```
pages/
  index.tsx              → redirect to /dashboard
  dashboard.tsx          → Overview with decision bar, action alerts, Colorado move, costs
  evaluate.tsx           → Camera → AI → Dual perspectives → Result → Override → Save
  log.tsx                → Searchable/filterable item log with detail overlay
  bins.tsx               → Box management (plastic boxes + suitcases), Colorado placement
  trips.tsx              → Travel event management, suitcase manifest
  discuss.tsx            → NEEDS-HUMAN items with resolve workflow
  customs.tsx            → Italian customs review, active-use confirmation flow
  settings.tsx           → All settings: rates, rules, perspectives, customs, help
  distinta.tsx           → Italian customs declaration (print-to-PDF, legacy)
  labels.tsx             → Customs-compliant box labels (print-to-PDF)
  manifest/[id].tsx      → Per-box printable packing list
  export/inventory.tsx   → Full inventory with photos (print-to-PDF)
  login.tsx              → Auth page
  _app.tsx               → AppProvider, MotionGate, OnboardingGate
  api/
    anthropic.ts         → AI evaluation proxy (keeps API key server-side)
    health.ts            → Health check endpoint

components/
  AuthGuard.tsx          → Redirects unauthenticated users to /login
  Nav.tsx                → Bottom navigation bar (7 tabs)
  SyncIndicator.tsx      → Online / syncing / offline status dot
  Walkthrough.tsx        → First-time onboarding walkthrough + HelpAccordion
  HelpHint.tsx           → Contextual help hints + InfoButton

lib/
  context.tsx            → AppProvider, useApp, reducer, Realtime subscriptions
  types.ts               → Entry, Box, Trip, Location, CernitaSettings, Decision, rules types
  supabase.ts            → Supabase client (browser-side)
  exportCsv.ts           → CSV export utility
  haptic.ts              → Vibration feedback utility (5 presets)
  useCountUp.ts          → RAF-based count-up animation hook
  costs.ts               → Cost re-computation (bulk re-derive without AI)
  customs.ts             → Customs category assignment, completeness checks, declaration generation
  perspectives.ts        → Dual-perspective evaluation (ship-lens vs save-lens)
  rules.ts               → Decision rules engine: matching, suggestions, formatting

styles/
  globals.css            → All CSS. Tokens → layout → components → animations

.specify/
  memory/constitution.md → 14 non-negotiable principles (read this first)
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
| `action_phase` | text | `'NOW'` or `'COLORADO'` — when the action happens |
| `user_confirmed` | bool | true once user accepts or overrides |
| `override_reason` | text | Set when user disagrees with AI |
| `override_tags` | jsonb | Array of tag IDs (voltage, sentimental, etc.) |
| `italy_confirmed` | bool | Active-use gate: must be true for customs declaration |
| `estimated_resale_value` | numeric | USD |
| `replacement_cost` | numeric | USD |
| `weight_lb` | numeric | |
| `volume_cuft` | numeric | |
| `storage_cost_total` | numeric | Computed from rules |
| `ship_cost` | numeric | Computed from rules |
| `net_cost_ship` | numeric | replace - resale - ship |
| `net_cost_storage` | numeric | replace - resale - storage |
| `recommendation_rationale` | text | English rationale |
| `recommendation_rationale_it` | text | Italian rationale |
| `confidence` | text | high / medium / low |
| `fragility` | text | none / low / medium / high / irreplaceable |
| `survival_risk` / `survival_risk_it` | text | Preservation warning (bilingual) |
| `packing_notes` / `packing_notes_it` | text | Packing guidance (bilingual) |
| `shipping_restriction` | text | none / restricted / prohibited |
| `shipping_restriction_note` / `_it` | text | Hazmat note (bilingual) |
| `voltage_incompatible` | bool | True if US 110V/60Hz item |
| `oversized` | bool | True if item can't fit in a 27-gal box |
| `photo_data` | text | JPEG base64, compressed to ~200 KB |
| `box_id` | int8 (FK) | Which box this item is packed into |
| `current_location_id` | int8 (FK) | Physical location |
| `acquisition_year` | int | For customs eligibility (6-month rule) |
| `customs_category` | text | One of 9 Italian customs categories |
| `customs_eligible` | bool | Computed from acquisition_year |
| `customs_notes` | text | Per-item customs annotation |
| `customs_exclude` | bool | Manually excluded from declaration |
| `rules_version` | text | e.g. "1.0.3" — snapshot of rules at eval time |
| `rules_snapshot` | jsonb | Full settings snapshot at eval time |
| `created_at` / `updated_at` | timestamptz | |

### `cernita_boxes` — physical containers
| Column | Type | Notes |
|---|---|---|
| `id` | int8 (PK) | |
| `box_number` | text | e.g. "B-01", "S-01" |
| `destination` | text | Decision value: where this box is headed |
| `box_type` | text | `'plastic'` or `'suitcase'` |
| `current_location_id` | int8 (FK) | |
| `storage_requirement` | text | climate_controlled / standard / garage_ok |
| `colorado_placement` | text | ACTIVE-USE / HOUSE-STORAGE / GARAGE |
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

| Value | English | Italian | Phase? |
|---|---|---|---|
| `SHIP-ITALY` | Ship to Italy | Spedire in Italia | No (implicit: Italy move) |
| `SELL` | Sell | Vendi | NOW or COLORADO |
| `DONATE` | Donate | Dona | NOW or COLORADO |
| `DISPOSE` | Dispose | Smaltisci | Typically NOW |
| `GIVE-FAMILY` | Give to family | Dai alla famiglia | Typically NOW |
| `CONSUME` | Use up | Consuma | Optional (COLORADO) |
| `NEEDS-HUMAN` | Needs discussion | Richiede discussione | No (decided during resolution) |

**Removed:** `KEEP-US` (no permanent US retention), `KEEP-ITALY` (renamed to `SHIP-ITALY`).

### Action Phase
SELL, DONATE, and CONSUME support a `NOW` or `COLORADO` phase — indicating when the action happens. SHIP-ITALY, DISPOSE, GIVE-FAMILY have implicit timing.

### Colorado Box Placement
Boxes destined for Colorado get a placement: `ACTIVE-USE` (unpacked, in daily use), `HOUSE-STORAGE` (climate-controlled workroom), or `GARAGE` (non-climate-controlled).

### Active-Use Re-Evaluation Gate
SHIP-ITALY items in ACTIVE-USE boxes must be re-confirmed (`italy_confirmed = true`) before appearing on the customs declaration. This prevents voltage-incompatible or worn-out items from silently ending up on customs lists.

---

## Dual-Perspective Evaluation

Every item is evaluated from two lenses:
1. **Ship perspective** (replacement-cost focused): Should we ship if replacing is expensive?
2. **Save perspective** (shipping-cost focused): Should we ship if shipping is cheap?

When perspectives disagree, the item routes to `NEEDS-HUMAN`. When they agree, confidence is higher. Thresholds are configurable in Settings.

## Decision Rules Engine

Users can create structured rules that override AI suggestions:
- Rules have conditions (field + operator + value), a default decision + phase, and a priority
- The system detects override patterns and suggests rules automatically
- Override tags (voltage, sentimental, too-heavy, etc.) feed the pattern detection
- Rules are stored in `CernitaSettings` (localStorage), not the database

---

## Settings (stored in localStorage, persisted per browser)

All settings live in `CernitaSettings` (`lib/types.ts`). Key ones:

| Setting | Default | Purpose |
|---|---|---|
| `usDestination` | "Colorado Springs" | Intermediate US city label |
| `movingRatePerLb` | $0.50 | Ground move cost (IL → CO) |
| `coloradoMoveRatePerCuFt` | $0 | Per-cu-ft rate (used if higher than per-lb) |
| `coloradoMoveFlatFee` | $0 | Flat fee component (truck rental, etc.) |
| `shippingRatePerLb` | $0.75 | Ocean shipping cost (CO → IT) |
| `shippingRatePerCuFt` | $4.00 | Ocean shipping cost (CO → IT) |
| `perspectiveShipThreshold` | 1.5 | Ship if replacement > ship * this |
| `perspectiveSellThreshold` | 0.5 | Sell if replacement < ship * this |
| `perspectiveSaveShipThreshold` | 0.3 | Ship if ship < replacement * this |
| `perspectiveSaveSellThreshold` | 0.7 | Sell if ship > replacement * this |
| `decisionRules` | [] | User-created and system-suggested rules |
| `checkedBagLimitLb` | 50 | Suitcase defaults |
| `carryOnLimitLb` | 22 | Suitcase defaults |
| `personalItemLimitLb` | 16 | Suitcase defaults |
| `aiModel` | claude-sonnet-4-5 | Swappable in Settings |
| `eurRate` | 0.92 | EUR/USD for customs documents |
| `italyAddress` | "" | Italian destination for box labels |
| `motionEnabled` | true | Feature flag: all animations |
| `rulesVersion` | "1.0.0" | Bumped when rates change; marks entries outdated |
| `customsProfile` | (defaults) | Declarant names, DOBs, addresses for customs |

---

## What has been shipped

### Formally specced and built
- **001** Bilingual item names — AI returns EN + IT item name
- **002** Bilingual rationale — AI returns EN + IT rationale paragraphs
- **003 / 009** Backend proxy + Supabase auth — login, AuthGuard, session
- **004 / 010** Vercel deployment + stack — Next.js 14, AppContext, Realtime
- **005** Log search — search bar + filter pills (decision, outdated, unboxed, phase)
- **006** Location tracking — locations table, box/item location picker, LocationsManager
- **007** Trips & suitcases — Trips page, suitcase manifest, weight gauges, execute/lock
- **008** Preservation — fragility, survival_risk, packing_notes in AI output and UI
- **011** Core evaluation — camera, AI, result card, dual perspectives, override with tags, save
- **012** CSV export — full data export in Log header and Settings
- **013** Log tab — filterable log, detail overlay, box/location assignment
- **014** Settings tab — rates, perspectives, rules, AI model, bag limits, locations, customs, help
- **015** Italian customs — declarant profile, customs review at `/customs`, category grouping, completeness checks, EUR conversion, active-use confirmation flow, printable dichiarazione sostitutiva + elenco beni
- **016** Phased item flow (5 builds) — revised decision model (SHIP-ITALY, CONSUME, action phases), Colorado box placement, active-use re-evaluation gate, structured rules engine with suggestions, dual-perspective evaluation, override tags with pattern detection, Colorado move cost estimation, first-time onboarding walkthrough, Settings help accordion, contextual info icons, first-use hints
- **017** Security & safety — threat model, 28 security requirements, OWASP mapping, security headers, risk register
- **018** Evaluation chat dialog — draft spec written, not yet implemented

### Shipped without formal specs (P10 violation — retroactive specs required)
- Dashboard / overview — count-up stats, decision bar, action alerts, Colorado move section, cost summary
- Oversized items — AI flags items too large for 27-gal box; `◱` badge; box assignment blocked
- Destination enforcement — SELL/DONATE/DISPOSE blocked from boxes; SHIP-ITALY → only SHIP-ITALY boxes
- Box manifests — printable per-box packing list at `/manifest/[id]`
- Inventory PDF export — full inventory with photos at `/export/inventory`, grouped by decision
- Italian customs distinta — D.P.R. 43/1973 declaration at `/distinta` (legacy, superseded by `/customs`)
- Box labels — customs-compliant labels at `/labels` with KG weight, handling marks, bilingual
- Motion & animations — feature-flagged: staggered lists, spring-back, haptics; toggle in Settings
- Unboxed item labelling — `◻ Unboxed` filter pill; location picker on loose items
- Shipping restrictions / hazmat — AI flags prohibited/restricted; badges in Log and result card
- Storage requirements — boxes get climate_controlled/standard/garage_ok label
- Item model identification — AI identifies brand+model from photo
- Voltage incompatibility — AI flags US 110V/60Hz items; transformer cost in rationale
- Bulk re-derive — Settings button batch-updates outdated entries with current rates
- Discuss tab — NEEDS-HUMAN items list with resolve workflow, Nav badge
- Multi-item photo evaluation — AI detects multiple items per photo; stepper UI
- Data deletion flow — Settings "Delete all my data" with two-step confirmation

### Pending migrations (run on Supabase if not already applied)
- `docs/migration-010-plastic-boxes.sql` — renames box_type 'cardboard' → 'plastic'
- `docs/migration-011-oversized.sql` — adds `oversized boolean` column to entries
- `docs/migration-015-customs.sql` — adds customs fields to entries
- `docs/migration-016-item-flow.sql` — KEEP-ITALY→SHIP-ITALY, removes KEEP-US, adds action_phase, override_tags, italy_confirmed, colorado_placement

---

## What is outstanding

### 1. Evaluation chat dialog *(spec 018 — draft exists)*
In-evaluation AI conversation via SSE streaming. Users can challenge, question, or provide context about an item's evaluation. Requires `cernita_chat_messages` table, `/api/anthropic-chat` endpoint, bottom-sheet chat UI. Spec is written; implementation not started.

### 2. Discuss tab: comment thread *(Constitution P4)*
The current Discuss tab shows NEEDS-HUMAN items with a one-sided resolve workflow. It lacks per-user positions and back-and-forth comments between both users. Needs a spec.

### 3. Moving company & insurance formats *(Constitution P12)*
Outputs for insurance manifests and moving company inventories need to conform to the actual carrier's and insurer's format requirements. Needs: identify carrier/insurer, obtain formats, build targeted exports.

### 4. Retroactive specs for 17 shipped features *(Constitution P10)*
17 features shipped without formal specs. Each needs a `spec.md` in `.specify/specs/NNN-feature/`. See the "Shipped without formal specs" list above.

---

## Key constraints for new engineers

1. **No Tailwind, no component library.** All CSS is in `styles/globals.css` with custom properties. Adding a UI library would violate Constitution P6.
2. **No App Router.** This is Pages Router. `getServerSideProps` / `getStaticProps` only.
3. **All AI calls go through `/api/anthropic`.** Never call Anthropic directly from the browser. The API key lives in Vercel environment variables only.
4. **Settings are localStorage, not a database table.** `AppContext` persists settings to `localStorage` on every dispatch. There is no `cernita_settings` table.
5. **Two-phone Realtime sync is live.** `AppContext` subscribes to all four tables. Any write to Supabase triggers a real-time update on both phones. Do not bypass this with optimistic updates that don't eventually write to Supabase.
6. **Every user-facing permanent record must be bilingual.** (Constitution P11.) If you add a field that appears in a manifest, export, or customs document, it needs both an English and Italian version.
7. **Animation CSS is gated behind `.motion-enabled` on `<body>`.** `MotionGate` in `_app.tsx` controls this based on `settings.motionEnabled`. New animations use `.motion-enabled .your-class` selectors only.
8. **Onboarding is in `_app.tsx`.** `OnboardingGate` checks `hasSeenOnboarding` in localStorage and shows the walkthrough on first login. Help content lives in `components/Walkthrough.tsx`.
9. **Decision rules are client-side.** Rules are stored in `CernitaSettings` (localStorage), matched after AI evaluation, and never sent to the server as enforcement logic.
10. **Active-use gate is enforced in customs.** Items with `decision = SHIP-ITALY` in `ACTIVE-USE` boxes that don't have `italy_confirmed = true` are excluded from the customs declaration by `lib/customs.ts`.

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
npx tsc --noEmit  # Type check
```

The app requires HTTPS for camera access. In local development, `localhost` is treated
as secure by most browsers. For testing on a phone over the local network, use a tool
like `ngrok` or Vercel preview deployments.

---

## Reference

- Constitution: `.specify/memory/constitution.md` (14 principles, v1.7)
- Feature specs: `.specify/specs/NNN-feature/spec.md` (001–018)
- Pending migrations: `docs/migration-*.sql`
- Design system: `:root` tokens in `styles/globals.css`
- AI prompt: `pages/api/anthropic.ts` — full prompt and JSON schema
- Rules engine: `lib/rules.ts` — matching, suggestions, formatting
- Perspectives: `lib/perspectives.ts` — dual-lens evaluation
- Customs: `lib/customs.ts` — category assignment, completeness, declaration
