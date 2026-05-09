# Spec 019 — Dashboard / Overview

**Status:** Shipped (retroactive spec)
**Priority:** P1
**Dependencies:** 010 (stack), 011 (core evaluation), 016 (item flow)

## Problem

Users need a single-screen overview of their entire move: how many items are evaluated, what decisions have been made, what needs attention, what the costs look like, and where things stand with boxes and trips. Without this, they have to mentally aggregate information across the Log, Bins, and Trips pages.

## User Stories

### US-1: Morning check-in
> As a user, I want to see at a glance how many items I've evaluated and what the decision breakdown is, so I know how the sorting process is progressing.

### US-2: Action alerts
> As a user, I want to see which items need my attention (discussion needed, hazmat flagged, items not yet boxed) so I can prioritize my work for the day.

### US-3: Cost awareness
> As a user, I want to see estimated shipping costs (ground move + ocean freight) so I can track whether the move is staying within budget.

### US-4: Colorado planning
> As a user, I want to see the Colorado move breakdown — how many items go where (active use, house storage, garage) and what the ground move will cost — so I can plan the truck and house layout.

### US-5: Trip awareness
> As a user, I want to see upcoming trips with suitcase counts so I know what travel is planned.

## Acceptance Criteria

### AC-1: Hero metric
A large count-up number showing total items evaluated. Animated on page load (gated behind `.motion-enabled`). Bilingual label: "At a glance · Panoramica".

### AC-2: Decision breakdown bar
A horizontal stacked bar showing the proportion of each decision. Each segment is color-coded using the decision badge palette (terracotta for SHIP-ITALY, etc.). A legend below the bar shows each decision with its count.

### AC-3: Action alerts
Alert cards appear for:
- **NEEDS-HUMAN**: count of items needing discussion, links to Discuss page
- **Prohibited hazmat**: count of items with `shipping_restriction === 'prohibited'`
- **Restricted hazmat**: count of items with `shipping_restriction === 'restricted'`
- **Unboxed**: count of SHIP-ITALY items without a `box_id`

Each alert shows an icon, count, and bilingual label. Alerts with count 0 are hidden.

### AC-4: Italy-bound summary
Shows aggregates for all SHIP-ITALY items:
- Total weight (lb)
- Total volume (cu ft)
- Total estimated ocean shipping cost

Section hidden when no SHIP-ITALY items exist.

### AC-5: Colorado move section
Shows:
- **Item count, weight, volume** for all items traveling to Colorado (SHIP-ITALY + items with `action_phase === 'COLORADO'`)
- **Placement breakdown**: count of boxes in each `colorado_placement` category (ACTIVE-USE, HOUSE-STORAGE, GARAGE)
- **Destiny breakdown**: final destination of Colorado items (Ship to Italy, Sell in CO, Donate in CO, Consume)
- **Ground move cost estimate**: `max(weight * movingRatePerLb, volume * coloradoMoveRatePerCuFt) + coloradoMoveFlatFee`

Section hidden when no Colorado-bound items exist.

### AC-6: Box summary
Shows total boxes, broken down by:
- Plastic boxes vs. suitcases
- Closed (sealed) count
- Climate-controlled count
- Garage-ok count

### AC-7: Upcoming trips
Shows up to 3 trips with status `planned` or `packing`, sorted by departure date. Each shows trip name, traveler, date, and suitcase count.

### AC-8: Cost summary
Two cost lines:
- **Ground move (IL to CO)**: weight-based estimate
- **Ocean shipping (CO to IT)**: sum of `ship_cost` for all SHIP-ITALY items

Total: ground + ocean.

### AC-9: Empty state
When no items have been evaluated, shows a centered message: "Nothing evaluated yet. Start by photographing an item."

### AC-10: Landing page redirect
The root route `/` redirects to `/dashboard` via `getServerSideProps` redirect. No flash of empty content.

## Data Model

No new tables. Dashboard reads from:
- `cernita_entries` (via AppContext `log`)
- `cernita_boxes` (via AppContext `boxes`)
- `cernita_trips` (via AppContext `trips`)
- `CernitaSettings` (from localStorage)

## UI States

### Layout
- Header: "Cernita" serif title + SyncIndicator
- Scrollable content area with card-style sections
- Bottom Nav bar

### Sections (in order)
1. Hero metric + decision bar
2. Action alerts (conditional)
3. Italy-bound summary (conditional)
4. Colorado move section (conditional)
5. Box summary
6. Upcoming trips (conditional)
7. Cost summary

### Design
- Section headers use serif font with bilingual labels
- Stat grids use 2-column layout on mobile
- Count-up animations via `useCountUp` hook (gated behind motionEnabled)
- Decision bar segments use `DECISION_BADGE_CLASS` colors

## Edge Cases

- **Zero items**: Show empty state (AC-9), hide all metric sections
- **No SHIP-ITALY items**: Hide Italy-bound and cost sections
- **No Colorado items**: Hide Colorado section
- **No trips**: Hide trips section
- **No boxes**: Show "0 boxes" in box summary
- **Auth loading**: Show SyncIndicator as "syncing" during initial load
- **Rate changes**: Dashboard uses current settings values; cost estimates update live when settings change

## Out of Scope

- Historical cost tracking (no time series)
- Goal setting ("we want to keep under $X")
- Print-friendly dashboard layout
- Dashboard-to-item deep links (tap a decision count to filter the Log)

## Key Files

- `pages/dashboard.tsx` — full page implementation
- `pages/index.tsx` — redirect to `/dashboard`
- `lib/useCountUp.ts` — animation hook for count-up numbers
- `styles/globals.css` — dashboard section classes (`dash-*`)
