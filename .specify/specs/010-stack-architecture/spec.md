# Stack and architecture

> Next.js Pages Router, CSS custom properties, React Context, Supabase Realtime. No Tailwind, no App Router, no clever abstractions. Simple enough to read, solid enough to ship.

| | |
|---|---|
| **Status** | draft |
| **Tier** | 4 (foundational — establishes the framework every other spec implements within) |
| **Branch** | `feat/architecture` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-05-03 |
| **Last updated** | 2026-05-03 |
| **Constitution principles** | Principle 6 (intentional design); Principle 7 (architecture serves the user); Principle 4 (two people, one truth — Realtime sync) |
| **Supersedes** | The single-file HTML architecture from v1.x |
| **Depends on** | Spec 009 (authentication) |

---

## Problem

The v1.x Cernita was a single HTML file with no build step. That worked until it didn't — no TypeScript, no module splitting, no proper API routes, no auth, no real structure. The rebuild starts fresh. This spec establishes what the stack is, what it is not, and why each choice was made so future contributors don't re-litigate the decisions.

## Design decisions

### Next.js 14 Pages Router, not App Router

Pages Router is stable and well-understood. App Router adds server components, streaming, and edge runtime complexity that serves zero of Cernita's users. API routes in Pages Router are simple `export default async function handler(req, res)` — no new paradigm to learn. The entire Cernita feature set fits in Pages Router without friction.

App Router is not wrong — it's just not justified here. If Cernita ever needs server-side rendering, streaming, or edge middleware at scale, this decision can be revisited.

### CSS custom properties, not Tailwind

The design system has 6 colors and 2 fonts. A `globals.css` with custom properties is 30 lines and is immediately readable to anyone who knows CSS. Tailwind would require every contributor to learn its class naming conventions and install a PurgeCSS pipeline for a project this size. Principle 7: architecture serves the user. Tailwind serves the developer's preference for utility classes.

### React Context + useReducer, not Redux or Zustand

Global state fits in a single context shape. Redux adds actions, reducers, middleware, and devtools boilerplate for what is essentially four arrays and a session object. Context + useReducer is the standard React solution for this scale and is understood without library documentation.

### Supabase Realtime, not polling

Two phones, one truth (Principle 4). Polling every N seconds creates stale views, missed concurrent edits, and jank. Supabase Realtime delivers row-level changes via WebSocket as they happen. Real-time sync is a constitutional requirement, not a feature preference.

## Acceptance criteria

### Framework

- [ ] **AC1** The app is a Next.js 14 project using the Pages Router. TypeScript throughout (`tsconfig.json` with `strict: true`). No App Router directories, no server components, no React Server Actions.

- [ ] **AC2** API routes live in `pages/api/`. Each route exports a standard Next.js handler: `export default async function handler(req: NextApiRequest, res: NextApiResponse)`. No edge runtime functions.

- [ ] **AC3** All pages except `pages/login.tsx` check for an active session on mount and redirect to `/login` if absent. The check uses the Supabase JS client's `session` from `onAuthStateChange` — no server-side session verification needed for page rendering.

### Design tokens

- [ ] **AC4** All styles use CSS custom properties defined in `styles/globals.css`. The canonical token set:

```css
:root {
  --terracotta: #c0622f;
  --terracotta-soft: #e8c4b0;
  --olive: #7a8c5e;
  --ink: #2c2c2c;
  --ink-soft: #6b6b6b;
  --paper: #faf7f2;
  --paper-dark: #f0ebe1;
  --font-serif: 'Cormorant Garamond', Georgia, serif;
  --font-sans: 'Lato', system-ui, sans-serif;
  --radius: 6px;
  --shadow-card: 0 1px 3px rgba(44, 44, 44, 0.12);
}
```

- [ ] **AC5** No Tailwind, no CSS-in-JS, no styled-components, no CSS Modules for feature code. Plain CSS class names scoped by component prefix (`.eval-card`, `.log-row`, `.settings-section`). New UI elements introduced by future specs must use these tokens, not hardcoded values.

- [ ] **AC6** Cormorant Garamond and Lato are loaded via Google Fonts in `pages/_document.tsx` with `display=swap`. The `<link rel="preconnect">` tags are included for performance.

### State management

- [ ] **AC7** A single `AppContext` (defined in `lib/context.tsx`) provides global state and dispatch to the entire app. Initial shape:

```typescript
interface AppState {
  session: Session | null;
  user: User | null;
  log: Entry[];
  boxes: Box[];
  locations: Location[];
  trips: Trip[];
  syncStatus: 'online' | 'syncing' | 'offline';
}
```

Additional slices (`boxes`, `locations`, `trips`) activate when their respective specs ship and their tables exist in the database.

- [ ] **AC8** `AppContext` is provided in `pages/_app.tsx`. It calls `supabase.auth.onAuthStateChange` to keep `session` and `user` current without polling.

- [ ] **AC9** Data arrays are loaded on auth via a single `loadAll()` function that fetches each table and dispatches `SET_LOG`, `SET_BOXES`, `SET_LOCATIONS`, `SET_TRIPS` to the reducer. Subsequent changes arrive via Realtime (AC10).

### Realtime sync

- [ ] **AC10** On auth, a Supabase Realtime channel subscribes to all data tables. INSERT, UPDATE, and DELETE events dispatch to the AppContext reducer, keeping the in-memory arrays current without refetching.

```typescript
supabase
  .channel('cernita-sync')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'cernita_entries' },
    (payload) => dispatch({ type: 'REALTIME_ENTRY', payload }))
  // repeat for boxes, locations, trips
  .subscribe((status) => dispatch({ type: 'SET_SYNC', payload: status }))
```

- [ ] **AC11** The sync status is visible in the app header as a small indicator dot: green (online), amber (syncing), red (offline). Offline state is detected when the Realtime channel status becomes `CLOSED` or `CHANNEL_ERROR`.

### Photo capture

- [ ] **AC12** Photo capture uses `getUserMedia({ video: { facingMode: 'environment' } })` — rear camera on mobile. A `<canvas>` element captures the frame and compresses it to JPEG ≤200KB before storing as base64 in `cernita_entries.photo_data`. If `getUserMedia` is unavailable or denied, a text-description fallback is offered.

### PWA

- [ ] **AC13** The app includes a `public/manifest.json` for PWA installation:

```json
{
  "name": "Cernita",
  "short_name": "Cernita",
  "display": "standalone",
  "background_color": "#faf7f2",
  "theme_color": "#c0622f",
  "start_url": "/",
  "icons": [...]
}
```

`pages/_document.tsx` includes `<link rel="manifest">` and the Apple-specific meta tags for iOS "Add to Home Screen" support.

### Project structure

- [ ] **AC14** The project follows this directory layout:

```
/
├── pages/
│   ├── _app.tsx          ← AppContext provider, auth state listener
│   ├── _document.tsx     ← fonts, manifest link, meta
│   ├── index.tsx         ← Evaluate tab (default route)
│   ├── log.tsx           ← Log tab
│   ├── bins.tsx          ← Bins tab
│   ├── trips.tsx         ← Trips tab (activates when spec 007 ships)
│   ├── discuss.tsx       ← Discuss tab
│   ├── settings.tsx      ← Settings tab
│   ├── login.tsx         ← Login screen (unauthenticated)
│   └── api/
│       ├── anthropic.ts  ← AI proxy (Anthropic API)
│       ├── bland.ts      ← Phone call proxy (Bland AI)
│       └── health.ts     ← Uptime check (unauthenticated)
├── components/
│   ├── Nav.tsx           ← Bottom tab bar (mobile) / sidebar (desktop)
│   ├── SyncIndicator.tsx ← Online/syncing/offline dot
│   └── ...               ← Feature-specific components per spec
├── lib/
│   ├── supabase.ts       ← Supabase client singleton
│   ├── auth.ts           ← Backend auth middleware (getUser from Bearer token)
│   ├── context.tsx       ← AppContext, AppState, reducer, types
│   └── types.ts          ← TypeScript interfaces for all DB rows
└── styles/
    └── globals.css       ← Design tokens, base styles, reset
```

## Out of scope

- Server-side rendering (SSR) — all pages are client-rendered after auth
- Edge runtime — standard Node.js serverless functions are sufficient
- i18n routing framework — bilingual content lives in data fields (English + Italian columns), not URL routes
- Storybook or component library
- Testing framework — manual testing per spec checklists
- Docker / containerization — Vercel handles deployment

## References

- Constitution Principles 4, 6, 7
- Spec 009 (authentication — establishes session model this spec builds on)
- Next.js 14 Pages Router documentation
- Supabase Realtime documentation
- Amendment 002 (Principle 3) — no user-managed infrastructure
