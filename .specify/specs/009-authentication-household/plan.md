# Implementation Plan: Authentication + Stack Scaffold

**Branch**: `claude/exciting-thompson-d8f157` | **Date**: 2026-05-04  
**Specs**: 009 (authentication), 010 (stack & architecture)

## Summary

Scaffold the full Next.js 14 Pages Router application with Supabase auth, AppContext + Realtime, design tokens, and the complete project directory structure. This is the foundation every other spec builds on. Auth ships as part of the scaffold — there is no "app without auth" state.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18+  
**Primary Dependencies**: Next.js 14, @supabase/supabase-js 2.x, React 18  
**Storage**: Supabase (PostgreSQL) — database connection is server-side only  
**Testing**: Manual testing checklist per spec  
**Target Platform**: Vercel (serverless), mobile browsers (iOS Safari, Android Chrome), PWA  
**Project Type**: Web application (Next.js Pages Router)  
**Performance Goals**: Login round-trip < 2s on mobile; page transitions < 200ms  
**Constraints**: No Tailwind, no CSS-in-JS, no App Router, CSS custom properties only  
**Scale/Scope**: 2 users, ~1000 entries, one deployment

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| P3 — Data belongs to user | Supabase URL/key never shown to user; login screen only | ✓ PASS |
| P4 — Two people, one truth | Realtime subscription established at auth; both phones share AppContext data | ✓ PASS |
| P6 — Intentional design | Cormorant Garamond + Lato + CSS tokens enforced; no framework defaults | ✓ PASS |
| P7 — Architecture serves user | Pages Router chosen over App Router complexity; no Tailwind for user's sake | ✓ PASS |
| P9 — Safety as default | Session expires → redirect to login; tokens never logged | ✓ PASS |

No violations. No complexity tracking needed.

## Project Structure

```text
/                              ← Next.js project root (worktree root)
├── pages/
│   ├── _app.tsx               ← AppContext provider, onAuthStateChange
│   ├── _document.tsx          ← Google Fonts, manifest link, meta
│   ├── index.tsx              ← Evaluate tab (redirects to /login if no session)
│   ├── log.tsx                ← Log tab
│   ├── bins.tsx               ← Bins tab (stub)
│   ├── trips.tsx              ← Trips tab (stub)
│   ├── discuss.tsx            ← Discuss tab (stub)
│   ├── settings.tsx           ← Settings tab
│   ├── login.tsx              ← Login screen (unauthenticated)
│   └── api/
│       ├── anthropic.ts       ← AI proxy (Anthropic)
│       ├── bland.ts           ← Phone call proxy (stub)
│       └── health.ts          ← Uptime check
├── components/
│   ├── Nav.tsx                ← Bottom tab bar (mobile) / sidebar (desktop)
│   ├── SyncIndicator.tsx      ← Online/syncing/offline dot
│   └── AuthGuard.tsx          ← Wraps authenticated pages
├── lib/
│   ├── supabase.ts            ← Supabase client singleton
│   ├── auth.ts                ← API route auth middleware
│   ├── context.tsx            ← AppContext, AppState, useAppContext
│   └── types.ts               ← TypeScript interfaces for all DB rows
├── styles/
│   └── globals.css            ← Design tokens, base styles, reset
├── public/
│   └── manifest.json          ← PWA manifest
├── package.json
├── tsconfig.json
└── next.config.js
```

## Implementation Phases

### Phase 1 — Project scaffold + design system
- `npx create-next-app@14` with TypeScript, no Tailwind, no App Router
- `npm install @supabase/supabase-js`
- `styles/globals.css` with full token set
- `pages/_document.tsx` with Google Fonts
- `public/manifest.json` PWA manifest

### Phase 2 — Auth (spec 009)
- `lib/supabase.ts` — Supabase client with NEXT_PUBLIC env vars
- `lib/auth.ts` — server-side JWT verification middleware
- `lib/types.ts` — Entry, Box, Location, Trip, AppState interfaces
- `lib/context.tsx` — AppContext, reducer, AppProvider
- `pages/login.tsx` — full login screen (design system applied)
- `pages/_app.tsx` — AppProvider, onAuthStateChange

### Phase 3 — App shell (spec 010)
- `components/Nav.tsx` — 6-tab bottom nav with active state
- `components/SyncIndicator.tsx` — Realtime status dot
- `components/AuthGuard.tsx` — redirect-to-login wrapper
- `pages/index.tsx` — Evaluate tab scaffold (camera + text fallback)
- `pages/api/health.ts` — unauthenticated health endpoint
- Page stubs: `log.tsx`, `bins.tsx`, `trips.tsx`, `discuss.tsx`, `settings.tsx`

### Phase 4 — Database schema SQL
- Write `docs/schema.sql` with the complete `cernita_entries` CREATE TABLE from spec 011
- RLS policies per spec 009

## Environment Variables

```
# Frontend (NEXT_PUBLIC_ — safe to expose; RLS is the security layer)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-side only (Vercel env, never in client bundle)
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```
