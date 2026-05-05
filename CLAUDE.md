# CLAUDE.md — Cernita agent instructions

## Project identity

Cernita is a moving inventory and decision support tool for an international move (Illinois → Texas → Italy). It serves two users (a couple) on mobile phones, helping them decide what to keep, sell, donate, ship, or carry — with honest economic math, bilingual output (English + Italian), and preservation-aware packing guidance.

## Constitution

Read `.specify/memory/constitution.md` before any implementation work. It contains 13 non-negotiable principles. Key ones:

- **Principle 1:** The user owns the decision. Never override silently.
- **Principle 2:** Honest math, always shown. No hidden assumptions.
- **Principle 3:** Data lives with the user (Supabase, user's own project).
- **Principle 4:** Two people, one truth. Everything works for simultaneous use on two phones.
- **Principle 6:** Intentional design. No framework defaults. Cormorant Garamond serif, terracotta + olive palette.
- **Principle 7:** Architecture serves the user, not the developer.
- **Principle 10:** Specs over code. When they disagree, the spec is the source of truth.
- **Principle 11:** Bilingual output (English + Italian) for all permanent records.
- **Principle 13:** Preservation is part of the math.

## Architecture (rebuild)

This is a fresh rebuild. The previous single-file HTML app is being replaced. Key architectural decisions for the rebuild:

- **No in-UI Supabase config.** Database connection is server-side.
- **Normal authentication.** Login screen + session, not settings-field passwords.
- **App calls its own backend.** No "Worker URL" or "Cernita URL" field.
- **Household identity via authenticated user.** Not a typed string.
- **Stack:** Vercel + Supabase + serverless functions.

## Spec-driven workflow

1. Every feature has a spec at `.specify/specs/NNN-feature/spec.md` before implementation
2. Specs include: user stories, acceptance criteria, data model, UI states, edge cases, out-of-scope
3. Changes to behavior require spec updates first
4. The Constitution overrides any individual spec
5. Read the relevant spec + Constitution before writing code

## Feature status

**Shipped in rebuild:**
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

**Shipped (no formal spec yet — needs spec written):**
- Unboxed item labelling — "◻ Unboxed" filter pill; location picker on loose items;
  loose items shown with weight/volume/est-ship-cost in Bins location view
- Shipping restrictions / hazmat — AI flags prohibited/restricted items (lithium batteries,
  aerosols, flammables); 🚫/⚠️ badges in Log and result card; migration 008
- Storage requirements — boxes get climate_controlled/standard/garage_ok label;
  shown in BoxCard and BoxDetailOverlay; migration 008
- Item model identification — AI identifies brand+model from photo for pricing accuracy;
  shown in result card and detail overlay; migration 009

**Requested, not yet built:**
- PDF export with photos (spec needed — user requested)
- Italian government import / customs declaration forms (spec needed — user requested)
- Dashboard / statistics overview (total weight, costs, decision breakdown)
- Box manifests — printable per-box packing list
- Motion / animations — constitution principle 6: count-up, staggered reveals, spring-back, haptic

## Design system

- **Typography:** Cormorant Garamond (serif, primary), Lato (sans, secondary)
- **Colors:** terracotta, olive, ink, ink-soft, paper, paper-dark
- **Motion:** count-up animations, staggered card reveals, spring-back on tap, haptic feedback
- **Spirit:** "a couple's careful, almost romantic preparation for a new life"
- **Anti-pattern:** "Default Bootstrap card with rounded corners and a subtle gradient" is a Constitution violation.

## Database

Supabase (PostgreSQL). Key tables:
- `cernita_entries` — evaluated items with bilingual names, rationales, decisions, photos
- `cernita_boxes` — physical containers (cardboard, plastic, suitcase)
- `cernita_locations` — where boxes/items physically are
- `cernita_trips` — planned/executed travel events
- `cernita_calls` — AI phone call records

## Testing

Manual testing checklist pattern (from specs):
- Fresh install works
- Existing user migration works
- Two phones see same data in real time (Supabase sync)
- Old cached version degrades gracefully
- Mobile keyboard behavior is correct

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
