# CLAUDE.md — Cernita agent instructions

## Project identity

Cernita is a moving inventory and decision support tool for an international move (Illinois → Colorado → Italy). It serves two users (a couple) on mobile phones, helping them decide what to keep, sell, donate, ship, or carry — with honest economic math, dual-perspective evaluation, bilingual output (English + Italian), and preservation-aware packing guidance.

## Constitution

Read `.specify/memory/constitution.md` before any implementation work. It contains 14 non-negotiable principles. Key ones:

- **Principle 1:** The user owns the decision. Never override silently.
- **Principle 2:** Honest math, always shown. No hidden assumptions.
- **Principle 3:** Data belongs to the user (Supabase, portable, exportable, deletable).
- **Principle 4:** Two people, one truth. Everything works for simultaneous use on two phones.
- **Principle 6:** Intentional design. No framework defaults. Cormorant Garamond serif, terracotta + olive palette.
- **Principle 7:** Architecture serves the user, not the developer.
- **Principle 10:** Specs over code. When they disagree, the spec is the source of truth.
- **Principle 11:** Bilingual output (English + Italian) for all permanent records.
- **Principle 12:** Compliance with destination requirements (Italian customs, insurance, carrier formats).
- **Principle 13:** Preservation is part of the math.
- **Principle 14:** Security is verified before every release. Spec 017 requirements are a pre-release gate, not a one-time audit.

## Architecture

- **Stack:** Next.js 14 Pages Router, TypeScript, Vercel, Supabase, no Tailwind, CSS custom properties only.
- **No in-UI Supabase config.** Database connection is server-side.
- **Normal authentication.** Login screen + session via Supabase Auth. `AuthGuard` wraps every page. Auth state uses `authLoading: boolean` — never redirects while auth is still initializing.
- **App calls its own backend.** AI calls go through `/api/anthropic` — API key stays server-side.
- **Household identity via authenticated user.** Not a typed string.
- **State:** `AppContext` with `useReducer` + Supabase Realtime subscriptions for two-phone sync.
- **Settings in localStorage** — `CernitaSettings` persisted per browser. No settings DB table.
- **Motion feature flag:** All CSS animations gated behind `.motion-enabled` class on `<body>`. `MotionGate` component in `_app.tsx` reads `settings.motionEnabled` and respects `prefers-reduced-motion`. Toggle in Settings.
- **Onboarding:** `OnboardingGate` in `_app.tsx` shows a 6-card walkthrough on first login. `hasSeenOnboarding` flag in localStorage. Help accordion in Settings with replay button.
- **Print-to-PDF pages** — `/distinta`, `/export/inventory`, `/manifest/[id]`, `/labels` use `window.print()` via manual button. No auto-print (blocks JS).

## Decision model (spec 016)

7 decisions: `SHIP-ITALY`, `SELL`, `DONATE`, `DISPOSE`, `GIVE-FAMILY`, `CONSUME`, `NEEDS-HUMAN`.
- **Removed:** `KEEP-US` (no permanent US retention), `KEEP-ITALY` (renamed to `SHIP-ITALY`).
- **Action phase:** SELL, DONATE, CONSUME support `NOW` or `COLORADO` timing.
- **Colorado box placement:** Boxes get `ACTIVE-USE`, `HOUSE-STORAGE`, or `GARAGE`.
- **Active-use gate:** SHIP-ITALY items in ACTIVE-USE boxes need `italy_confirmed = true` before appearing on customs declaration.
- **Dual perspectives:** Ship-lens (replacement-cost focused) vs save-lens (shipping-cost focused). Disagreement → NEEDS-HUMAN.
- **Decision rules:** User-created structured rules that override AI suggestions. System detects override patterns and suggests rules.
- **Override tags:** voltage, too-heavy, sentimental, cheap-to-replace, expensive-to-ship, fragile, daily-use, consumable, other.

## Spec-driven workflow

1. Every feature has a spec at `.specify/specs/NNN-feature/spec.md` before implementation
2. Specs include: user stories, acceptance criteria, data model, UI states, edge cases, out-of-scope
3. Changes to behavior require spec updates first
4. The Constitution overrides any individual spec
5. Read the relevant spec + Constitution before writing code

## Feature status

**Shipped with formal specs (001–018):**
- 001-bilingual-item-names — AI returns EN + IT item names
- 002-bilingual-rationale — AI returns EN + IT rationale paragraphs
- 003-backend-proxy / 009-authentication — Supabase auth, AuthGuard, session
- 004-vercel-deployment / 010-stack-architecture — Next.js 14, Vercel, AppContext, Realtime
- 005-log-search — search bar + filter pills (decision, outdated, unboxed, phase)
- 006-location-tracking — locations table, box location picker, LocationsManager in Settings
- 007-trips-suitcases — Trips page, suitcase manifest, weight gauges, execute/lock workflow
- 008-preservation — fragility, survival_risk, packing_notes in AI output and UI
- 011-core-evaluation — camera capture, AI evaluation, dual perspectives, result card, override with tags, save
- 012-csv-export — CSV export in Log header and Settings
- 013-log-tab — Log page with filters, detail overlay, box assignment, location assignment
- 014-settings-tab — Settings page with rates, perspectives, rules, AI model, bag limits, locations, customs profile, help
- 015-italian-customs — declarant profile in Settings, customs review at `/customs` with category grouping (9 Italian customs categories), completeness checks, active-use confirmation flow, EUR conversion, printable dichiarazione sostitutiva + elenco beni
- 016-item-flow (5 builds) — revised decision model (SHIP-ITALY, CONSUME, action phases), Colorado box placement, active-use re-evaluation gate, structured rules engine with suggestions, dual-perspective evaluation, override tags with pattern detection, Colorado move cost estimation (max(weight, volume) + flat fee), first-time onboarding walkthrough, Settings help accordion, contextual info icons, first-use hints
- 017-security-safety — threat model, 28 security requirements (SEC-AUTH/DATA/API/AI/HDR/DEP), OWASP Top 10 mapping, security headers, risk register
- 018-evaluation-chat — in-evaluation AI chat dialog, SSE streaming, chat messages table, bottom-sheet UI
- 019-dashboard — landing page with count-up stats, decision breakdown bar, action alerts, Colorado move section, cost summary
- 020-multi-item-evaluation — AI detects multiple items per photo, stepper UI, per-item confirmation, batch advancement
- 021-oversized-destination-enforcement — oversized detection + box assignment blocking, destination-matched packing, non-packable items

**Shipped without formal specs (needs specs written — P10 violation):**
- Box manifests — printable per-box packing list at `/manifest/[id]`
- Inventory PDF export — full inventory with photos at `/export/inventory`, grouped by decision
- Italian customs distinta — D.P.R. 43/1973 declaration at `/distinta`, SHIP-ITALY items only, bilingual (legacy, superseded by `/customs`)
- Box labels — customs-compliant labels at `/labels` with KG weight, handling marks, D.P.R. 43/1973 + UCC references, bilingual contents
- Motion & animations — feature-flagged: staggered list reveals, spring-back taps, phase transitions, weight bar grow, toast bounce, thinking pulse, haptic feedback (`lib/haptic.ts`); toggle in Settings
- Unboxed item labelling — `◻ Unboxed` filter pill; location picker on loose items; loose items shown in Bins location view
- Shipping restrictions / hazmat — AI flags prohibited/restricted items; badges in Log and result card; migration 008
- Storage requirements — boxes get climate_controlled/standard/garage_ok label; shown in BoxCard and BoxDetailOverlay; migration 008
- Item model identification — AI identifies brand+model from photo; shown in result card and detail overlay; migration 009
- Voltage incompatibility — AI flags US 110V/60Hz items; banner in result card + detail overlay; badge in Log; transformer cost factored into rationale; migration 012
- Bulk re-derive — Settings "Re-derive all" button batch-updates outdated entries with current rates via `lib/costs.ts`
- Discuss tab — NEEDS-HUMAN items list with DiscussCard, resolve workflow (6 decision options), Nav badge, evaluate→discuss routing; bilingual flags + AI rationale shown
- Multi-item photo evaluation — AI detects multiple items per photo, returns array; stepper UI ("Item 1 of N") with progress dots; each item confirmed/overridden/saved independently
- Data deletion flow — Settings → "Delete all my data" with two-step confirmation. Deletes entries, boxes, trips, locations from Supabase, clears localStorage, signs out. Constitution P3 compliance.

**Outstanding (not yet built):**
- Discuss tab: comment thread — per-user positions and back-and-forth comments between both users (current resolve workflow is functional but one-sided)
- Moving company / insurance manifest formats — Constitution P12 requires format-matched outputs for actual carrier and insurer
- 14 retroactive specs for remaining shipped features — required by Constitution P10

## Design system

- **Typography:** Cormorant Garamond (serif, primary), Lato (sans, secondary)
- **Colors:** terracotta (`#c0622f`), olive (`#7a8c5e`), gold (`#c9a84c`), ink (`#2c2c2c`), ink-soft (`#6b6b6b`), paper (`#faf7f2`), paper-dark (`#f0ebe1`)
- **Motion:** count-up animations (`lib/useCountUp.ts`), staggered list reveals (CSS `:nth-child`), spring-back on `:active` (cubic-bezier overshoot), haptic vibration (`lib/haptic.ts`). All gated behind `.motion-enabled` body class.
- **Spirit:** "a couple's careful, almost romantic preparation for a new life"
- **Anti-pattern:** "Default Bootstrap card with rounded corners and a subtle gradient" is a Constitution violation.

## Database

Supabase (PostgreSQL). Key tables:
- `cernita_entries` — evaluated items with bilingual names, rationales, decisions, photos, fragility, shipping restrictions, oversized flag, action_phase, override_tags, italy_confirmed, customs fields
- `cernita_boxes` — physical containers; `box_type: 'plastic' | 'suitcase'`; storage_requirement; colorado_placement; destination matching a Decision
- `cernita_locations` — where boxes/items physically are
- `cernita_trips` — planned/executed travel events with suitcase manifests

Pending migrations (not yet applied to all environments):
- `docs/migration-010-plastic-boxes.sql` — renames box_type 'cardboard' → 'plastic'
- `docs/migration-011-oversized.sql` — adds oversized boolean to entries
- `docs/migration-015-customs.sql` — adds customs fields to entries
- `docs/migration-016-item-flow.sql` — KEEP-ITALY→SHIP-ITALY, KEEP-US removal, action_phase, override_tags, italy_confirmed, colorado_placement

## Key files

- **AI prompt + schema:** `pages/api/anthropic.ts`
- **Global state:** `lib/context.tsx` (AppProvider, useReducer, Realtime)
- **Types:** `lib/types.ts` (Entry, Box, Trip, Location, CernitaSettings, Decision, rules types)
- **All CSS:** `styles/globals.css` (~5,000 lines, single file)
- **Constitution:** `.specify/memory/constitution.md` (14 principles, v1.7)
- **Requirements doc:** `REQUIREMENTS.md` (full handoff doc for engineers)
- **Rules engine:** `lib/rules.ts` (matching, suggestions, formatting)
- **Perspectives:** `lib/perspectives.ts` (dual-lens evaluation)
- **Customs:** `lib/customs.ts` (category assignment, completeness, declaration generation)
- **Cost recomputation:** `lib/costs.ts` (bulk re-derive without AI)
- **Onboarding:** `components/Walkthrough.tsx` (walkthrough cards + help accordion)
- **Help hints:** `components/HelpHint.tsx` (contextual hints + info button)

## Testing

Manual testing checklist pattern (from specs):
- Fresh install works (onboarding walkthrough shown)
- Existing user migration works
- Two phones see same data in real time (Supabase sync)
- Old cached version degrades gracefully
- Mobile keyboard behavior is correct
- Print pages (customs, distinta, inventory, manifest, labels) open without login redirect
- Active-use items excluded from customs until confirmed
- Decision rules match and override AI suggestions correctly
- Dual perspectives route disagreements to NEEDS-HUMAN

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
