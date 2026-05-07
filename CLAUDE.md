# CLAUDE.md — Cernita agent instructions

## Project identity

Cernita is a moving inventory and decision support tool for an international move (Illinois → Colorado → Italy). It serves two users (a couple) on mobile phones, helping them decide what to keep, sell, donate, ship, or carry — with honest economic math, bilingual output (English + Italian), and preservation-aware packing guidance.

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
- **Print-to-PDF pages** — `/distinta`, `/export/inventory`, `/manifest/[id]`, `/labels` use `window.print()` via manual button. No auto-print (blocks JS).

## Spec-driven workflow

1. Every feature has a spec at `.specify/specs/NNN-feature/spec.md` before implementation
2. Specs include: user stories, acceptance criteria, data model, UI states, edge cases, out-of-scope
3. Changes to behavior require spec updates first
4. The Constitution overrides any individual spec
5. Read the relevant spec + Constitution before writing code

## Feature status

**Shipped with formal specs (001–014):**
- 001-bilingual-item-names — AI returns EN + IT item names
- 002-bilingual-rationale — AI returns EN + IT rationale paragraphs
- 003-backend-proxy / 009-authentication — Supabase auth, AuthGuard, session
- 004-vercel-deployment / 010-stack-architecture — Next.js 14, Vercel, AppContext, Realtime
- 005-log-search — search bar + filter pills (decision, outdated, unboxed)
- 006-location-tracking — locations table, box location picker, LocationsManager in Settings
- 007-trips-suitcases — Trips page, suitcase manifest, weight gauges, execute/lock workflow
- 008-preservation — fragility, survival_risk, packing_notes in AI output and UI
- 011-core-evaluation — camera capture, AI evaluation, result card, override, save
- 012-csv-export — CSV export in Log header and Settings
- 013-log-tab — Log page with filters, detail overlay, box assignment, location assignment
- 014-settings-tab — Settings page with rates, AI model, bag limits, LocationsManager

**Shipped without formal specs (needs specs written — P10 violation):**
- Dashboard / overview — landing page with count-up stats, decision breakdown bar, action alerts, cost summary; redirect from `/` to `/dashboard`
- Oversized items — AI flags items too large for 27-gal box; `◱` badge; box assignment blocked; migration 011
- Destination enforcement — SELL/DONATE/DISPOSE blocked from boxes; KEEP-ITALY → only KEEP-ITALY boxes; GIVE-FAMILY → suitcases only
- Box manifests — printable per-box packing list at `/manifest/[id]`
- Inventory PDF export — full inventory with photos at `/export/inventory`, grouped by decision
- Italian customs distinta — D.P.R. 43/1973 declaration at `/distinta`, KEEP-ITALY items only, bilingual
- Box labels — customs-compliant labels at `/labels` with KG weight, handling marks, D.P.R. 43/1973 + UCC references, bilingual contents
- Motion & animations — feature-flagged: staggered list reveals, spring-back taps, phase transitions, weight bar grow, toast bounce, thinking pulse, haptic feedback (`lib/haptic.ts`); toggle in Settings
- Unboxed item labelling — `◻ Unboxed` filter pill; location picker on loose items; loose items shown in Bins location view
- Shipping restrictions / hazmat — AI flags prohibited/restricted items; 🚫/⚠️ badges in Log and result card; migration 008
- Storage requirements — boxes get climate_controlled/standard/garage_ok label; shown in BoxCard and BoxDetailOverlay; migration 008
- Item model identification — AI identifies brand+model from photo; shown in result card and detail overlay; migration 009
- Voltage incompatibility — AI flags US 110V/60Hz items; ⚡ banner in result card + detail overlay; ⚡ badge in Log; transformer cost factored into rationale; migration 012
- Bulk re-derive — Settings "Re-derive all" button batch-updates outdated entries with current rates via `lib/costs.ts`
- Discuss tab — NEEDS-HUMAN items list with DiscussCard, resolve workflow (6 decision options), Nav badge, evaluate→discuss routing; bilingual flags + AI rationale shown
- Multi-item photo evaluation — AI detects multiple items per photo, returns array; stepper UI ("Item 1 of N") with progress dots; each item confirmed/overridden/saved independently

- Italian customs declaration (spec 015) — declarant profile in Settings, customs review at `/customs` with category grouping (9 Italian customs categories), completeness checks, EUR conversion, printable dichiarazione sostitutiva + elenco beni. Auto-category assignment via keyword matching. Covers EU Reg. 1186/2009 Art. 3 (third-country provision for US citizens). Migration 015.
- Data deletion flow — Settings → "Delete all my data" with two-step confirmation. Deletes entries, boxes, trips, locations from Supabase, clears localStorage, signs out. Constitution P3 compliance.
- Security, safety & code quality (spec 017) — Threat model, 28 security requirements (SEC-AUTH/DATA/API/AI/HDR/DEP), OWASP Top 10 mapping, AI-assisted development governance, security headers in next.config.mjs, risk acceptance register. Constitution P14 compliance.

**Outstanding (not yet built):**
- Discuss tab: comment thread — per-user positions and back-and-forth comments between both users (current resolve workflow is functional but one-sided)
- Moving company / insurance manifest formats — Constitution P12 requires format-matched outputs for actual carrier and insurer
- 15 specs for shipped features — retroactive specs required by Constitution P10

## Design system

- **Typography:** Cormorant Garamond (serif, primary), Lato (sans, secondary)
- **Colors:** terracotta (`#c0622f`), olive (`#7a8c5e`), gold (`#c9a84c`), ink (`#2c2c2c`), ink-soft (`#6b6b6b`), paper (`#faf7f2`), paper-dark (`#f0ebe1`)
- **Motion:** count-up animations (`lib/useCountUp.ts`), staggered list reveals (CSS `:nth-child`), spring-back on `:active` (cubic-bezier overshoot), haptic vibration (`lib/haptic.ts`). All gated behind `.motion-enabled` body class.
- **Spirit:** "a couple's careful, almost romantic preparation for a new life"
- **Anti-pattern:** "Default Bootstrap card with rounded corners and a subtle gradient" is a Constitution violation.

## Database

Supabase (PostgreSQL). Key tables:
- `cernita_entries` — evaluated items with bilingual names, rationales, decisions, photos, fragility, shipping restrictions, oversized flag
- `cernita_boxes` — physical containers; `box_type: 'plastic' | 'suitcase'`; storage_requirement; destination matching a Decision
- `cernita_locations` — where boxes/items physically are
- `cernita_trips` — planned/executed travel events with suitcase manifests

Pending migrations (not yet applied to all environments):
- `docs/migration-010-plastic-boxes.sql` — renames box_type 'cardboard' → 'plastic'
- `docs/migration-011-oversized.sql` — adds oversized boolean to entries

## Key files

- **AI prompt + schema:** `pages/api/anthropic.ts`
- **Global state:** `lib/context.tsx` (AppProvider, useReducer, Realtime)
- **Types:** `lib/types.ts` (Entry, Box, Trip, Location, CernitaSettings, Decision)
- **All CSS:** `styles/globals.css` (~3,500 lines, single file)
- **Constitution:** `.specify/memory/constitution.md`
- **Requirements doc:** `REQUIREMENTS.md` (full handoff doc for engineers)

## Testing

Manual testing checklist pattern (from specs):
- Fresh install works
- Existing user migration works
- Two phones see same data in real time (Supabase sync)
- Old cached version degrades gracefully
- Mobile keyboard behavior is correct
- Print pages (distinta, inventory, manifest, labels) open without login redirect

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
