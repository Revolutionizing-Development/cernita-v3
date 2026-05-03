# Vercel deployment

> Restructure Cernita to deploy as a standard Vercel project with serverless functions, matching the deployment pattern already used for Kader AI. Replaces the Cloudflare Worker approach with Vercel API routes.

| | |
|---|---|
| **Status** | shipped (2026-04-28) |
| **Tier** | 3 (substantial — restructures file layout, replaces backend deployment target, changes the proxy contract slightly) |
| **Branch** | `feat/vercel-deployment` |
| **Author** | Cernita team |
| **Drafted** | 2026-04-28 |
| **Last updated** | 2026-04-28 |
| **Constitution principles** | Principle 7 (architecture serves the user, not the developer) — primary; Principle 8 (honest about limits); Principle 9 (safety as default) |
| **Supersedes** | Replaces the deployment portion of `/specs/backend-proxy.md`. The backend-proxy spec's authentication model and frontend changes remain valid; only the deployment target (Cloudflare → Vercel) and the URL/path structure change. |
| **Depends on** | None — this can be implemented standalone. The frontend changes from backend-proxy are already shipped in cernita.html. |

---

## Problem

The current backend-proxy spec assumed Cloudflare Workers as the deployment target. In practice, this turned out to be a poor fit for the actual user (the technical partner):

1. **Wrong tool for the audience.** The user has an established Vercel + GitHub workflow from a sibling project (Kader AI: 12 serverless functions, custom domain, environment-based secrets, GitHub auto-deploy). Cloudflare Workers required learning a new CLI (Wrangler), a new dashboard (Cloudflare), and a new mental model.

2. **Cloudflare Wrangler's first-time UX is unreliable.** The required `workers.dev` subdomain registration step has known intermittent failures via the CLI. The user hit them. The recovery path (use the dashboard) is undocumented and adds another tool to learn.

3. **Two URLs instead of one.** Frontend on Netlify, backend on `*.workers.dev`. Two CORS configurations, two deployment surfaces, two failure modes. CORS issues are solvable but unnecessary when one platform can serve both.

4. **Violates Constitution Principle 7.** "Architecture serves the user, not the developer." The Cloudflare path optimized for "lowest free-tier cost" instead of "fits the user's existing deployment muscle memory." For a user with deep Vercel experience, the optimization was wrong.

The decision to add a backend proxy was correct — API keys must not live in the phone. The choice of Cloudflare Workers as the deployment target was wrong.

## Why now

Three reasons:

1. **The user explicitly asked for this.** After hitting Cloudflare friction, the user requested matching the Kader AI deployment pattern. Direct user request, not a guess.

2. **The cost of switching is small now.** The backend proxy code is ~250 lines of one file (`worker.js`) with no internal state. Porting it to Vercel API routes is mechanical. Doing it later, after more features depend on Cloudflare-specific things, would be painful.

3. **Single deploy surface unblocks everything else.** With one URL serving both frontend and backend, future features (customs PDF generation, image upload to storage, etc.) can use the same patterns the user already understands from Kader.

## User story

> As the technical partner, I want to deploy Cernita the same way I deploy Kader AI: push to a GitHub repo, Vercel auto-deploys, secrets live in Vercel environment variables, custom domain managed through Vercel. No new tools to learn. No CLI prompts that fail intermittently. No second dashboard to remember.
>
> When I update Cernita, I push to GitHub. When I rotate a key, I run `vercel env add` or use the dashboard. When my wife needs the app, I give her one URL — `https://cernita-something.vercel.app` or `https://cernita.kaderrunning.ai` — and she opens it in her phone browser, taps Add to Home Screen, types her name and the household password, and uses Cernita. No mention of API keys ever.

## Acceptance criteria

### File structure changes

- [ ] **AC1** The project is restructured into a deployable Vercel project layout:
  ```
  cernita/
  ├── index.html              (was cernita.html — Vercel serves index.html as the root)
  ├── api/
  │   ├── anthropic.ts        (Vercel serverless function — Anthropic proxy)
  │   ├── bland.ts            (Vercel serverless function — Bland.ai create-call proxy)
  │   ├── bland-status.ts     (Vercel serverless function — Bland.ai status check)
  │   └── lib/
  │       └── auth.ts         (shared: household password verification)
  ├── vercel.json             (Vercel config: routes, headers, function timeouts)
  ├── package.json            (Node dependencies for the API functions)
  ├── .gitignore
  ├── .env.local.example      (template for local development)
  └── README.md               (deployment + dev instructions)
  ```

- [ ] **AC2** `cernita.html` is renamed to `index.html` so Vercel serves it as the root URL with no path manipulation.

- [ ] **AC3** All other documentation files (`CONSTITUTION.md`, `PROCESS.md`, `CHANGELOG.md`, etc.) move into a `docs/` subfolder. The `specs/` folder moves alongside as `specs/`. These are part of the repo (git-tracked) but not served by Vercel (excluded via `vercel.json` if needed).

- [ ] **AC4** A new file `cernita/specs/standards/` directory is created (empty for now, but reserved per CONSTITUTION.md Principle 12 — Italian customs format references will live here).

### Backend serverless functions

- [ ] **AC5** `api/anthropic.ts` accepts POST requests at `/api/anthropic`, forwards to `https://api.anthropic.com/v1/messages` with the real API key from `process.env.ANTHROPIC_API_KEY`. Same authentication contract as the Cloudflare Worker (Bearer token = household password).

- [ ] **AC6** `api/bland.ts` accepts POST requests at `/api/bland`, forwards to `https://api.bland.ai/v1/calls`. Same auth contract.

- [ ] **AC7** `api/bland-status.ts` accepts GET requests at `/api/bland-status?call_id=XYZ`, forwards to `https://api.bland.ai/v1/calls/XYZ`. (Vercel serverless functions don't support arbitrary path parameters as cleanly as `:id` style, so we use a query parameter — this is the only contract change from the Worker.)

- [ ] **AC8** A `/api/health` endpoint (either as `api/health.ts` or as a special-cased path in one of the existing handlers) returns `{ "status": "ok", "version": "X.Y.Z" }` without authentication. Used by the frontend's connection-test flow.

- [ ] **AC9** All authenticated endpoints require `Authorization: Bearer ${HOUSEHOLD_PASSWORD}` from `process.env.HOUSEHOLD_PASSWORD`. Mismatches return 401 with `{ "error": "Authentication failed. Check the household password in Settings." }`.

- [ ] **AC10** All endpoints set CORS headers permitting requests from the configured origin (default: `*` for initial setup; lockdown to a specific URL via `process.env.ALLOWED_ORIGIN` for production).

- [ ] **AC11** Function timeout is 30 seconds for `/api/anthropic` (matches Kader pattern, accommodates slow vision API responses with large prompts). Configured in `vercel.json`.

- [ ] **AC12** Errors are returned as structured JSON with a clear `error` field. Misconfigured environment (missing `ANTHROPIC_API_KEY`) returns 500 with a diagnostic message identifying which variable is missing.

### Frontend changes

- [ ] **AC13** The "Worker URL" field in Settings is renamed to "Cernita URL" with placeholder updated to a Vercel-style URL (e.g., `https://cernita.vercel.app` or the user's custom domain).

- [ ] **AC14** The frontend's proxy fetch helpers (`proxyAnthropicMessages`, `proxyBlandCreateCall`, `proxyBlandCallStatus`, `proxyHealthCheck`) update their paths:
  - `/anthropic/messages` → `/api/anthropic`
  - `/bland/calls` → `/api/bland`
  - `/bland/calls/:id` → `/api/bland-status?call_id=:id`
  - `/health` → `/api/health`

- [ ] **AC15** When the Cernita URL setting is empty (fresh install), the frontend defaults to relative paths (`/api/anthropic` etc.). This works automatically when the frontend is served from the same domain as the API — which is the Vercel default deployment. Only when frontend and API are on different domains does the user need to fill in the Cernita URL.

- [ ] **AC16** The migration banner copy is updated to match: "Configure the Cernita URL in Settings (or use the default if frontend and backend are on the same domain)."

### Configuration

- [ ] **AC17** `vercel.json` configures:
  - Function timeout (30s for anthropic, 30s for bland, 10s for bland-status, 5s for health)
  - Security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) matching Kader's pattern
  - No build command needed (HTML is already a static file; API functions are TypeScript that Vercel auto-compiles)

- [ ] **AC18** `package.json` declares only the dependencies the API functions need:
  - `@vercel/node` (for type definitions)
  - `@anthropic-ai/sdk` (or just use `fetch` directly to avoid the dependency — see implementation notes)
  - No frontend build dependencies — the HTML file is shipped as-is

- [ ] **AC19** `.env.local.example` documents required and optional environment variables:
  ```
  ANTHROPIC_API_KEY=sk-ant-...
  HOUSEHOLD_PASSWORD=your-shared-password
  BLAND_API_KEY=org_...    # optional, for phone calls
  ALLOWED_ORIGIN=*         # tighten in production
  ```

### Documentation

- [ ] **AC20** A new `INSTALL.md` (or significantly updated existing one) documents the deployment steps for the Vercel approach. Step-by-step: create GitHub repo, connect to Vercel, set environment variables, custom domain. Also covers per-device setup on phones and laptops (mostly unchanged from current INSTALL.md).

- [ ] **AC21** A new `README.md` at the repo root briefly describes Cernita and points to INSTALL.md and CONSTITUTION.md. Suitable for a public GitHub repo (no secrets).

- [ ] **AC22** The existing `DEPLOY-WORKER.md` and `worker.js` and `wrangler.toml` are removed from the repo (the Cloudflare path is no longer supported; keeping them around would confuse future readers).

- [ ] **AC23** The existing `backend-proxy.md` spec is updated with a note at the top: "Deployment target changed from Cloudflare Workers to Vercel by `/specs/vercel-deployment.md`. The authentication model and frontend changes remain in effect." Status stays `shipped` since the auth-and-frontend portion is shipped.

### Cleanup

- [ ] **AC24** The CHANGELOG entry for v1.3.0 is updated retroactively to acknowledge that the deployment target changed during the first attempt to ship. New entry for v1.3.1 (or v1.4.0, depending on tier) covers the Vercel migration specifically.

## Data model changes

**None.** This is purely a deployment and code-organization change. Database schema is unchanged.

## UI states

The user-visible behavior is identical to the Cloudflare-based version. The only differences:

- Settings field label changes from "Worker URL" to "Cernita URL"
- Default placeholder text changes to a Vercel-style URL
- When deployed to Vercel with the default same-domain pattern, the user can leave Cernita URL blank and the app uses relative paths

States are otherwise identical to backend-proxy.md.

## Edge cases

- **EC1** Frontend and backend on different domains. → User explicitly fills in Cernita URL. CORS lockdown via `ALLOWED_ORIGIN`. No different from current behavior.

- **EC2** Frontend and backend on same domain (default Vercel deployment). → Cernita URL can be blank. Relative paths work. Cleaner UX.

- **EC3** User on the old Cloudflare-based deployment loads the new code. → The new code's proxy paths are different (`/api/anthropic` vs `/anthropic/messages`). Old worker won't recognize them and returns 404. User must update Cernita URL in Settings to point at the new Vercel deployment. Toast: "Update Cernita URL in Settings — the path structure changed in this version."

- **EC4** Vercel function cold start latency. → First request after idle period takes 1-3 seconds longer. Acceptable; matches Kader's behavior. No mitigation needed for personal-use scale.

- **EC5** User accidentally deploys the repo without setting environment variables. → API endpoints return 500 with diagnostic JSON identifying missing variables. User adds them via `vercel env add` or dashboard, redeploys. Frontend shows clear error.

- **EC6** Vercel free tier function invocation limit (currently 100,000/month per project). → Cernita usage will not approach this. Even at 500 items × 5 evaluations during the move, that's 2,500 invocations.

- **EC7** Vercel free tier 12-function limit per project. → Cernita uses 4 functions (anthropic, bland, bland-status, health). Plenty of room for future additions.

- **EC8** Repository goes public on GitHub by accident. → Code contains no secrets (all secrets are in Vercel environment variables, never in the repo). Public exposure is not a security incident. The household password protects access; the repo being public has no impact on it.

- **EC9** User wants to use a custom domain. → Standard Vercel custom domain flow (add domain in Vercel dashboard, update DNS at the user's registrar, Vercel handles SSL). Documented in INSTALL.md.

- **EC10** TypeScript compilation errors. → Vercel won't deploy. User fixes locally, pushes, redeploys. Standard Vercel feedback loop.

- **EC11** A request body exceeds Vercel's 4.5MB default limit (e.g., a very large image). → Currently a non-issue (Cernita compresses images before sending). Configure higher limit in `vercel.json` if needed: `"maxDuration": 30, "memory": 1024`.

- **EC12** Two phones simultaneously hit the same endpoint. → Vercel serverless functions are stateless and scale automatically. No coordination needed.

## Out of scope

- **Image upload to Vercel Blob storage.** Currently images are stored as base64 in Supabase. Migrating to a separate storage service is a future spec.

- **Vercel Analytics or logging tier.** Free tier has minimal analytics; sufficient for personal use.

- **Multi-environment (preview / production / development) deployments.** Single environment per repo for now. Future spec could add staging.

- **A/B deployment or canary releases.** Not needed for a personal tool.

- **Rate limiting in the API functions.** Vercel doesn't have first-class rate limiting like Cloudflare's KV-based pattern. If needed later, can be added via an external service (Upstash Redis is the typical Vercel pairing) or via in-memory counters with the caveat that they reset on cold starts. Not implementing in v1.

- **Migrating off Vercel.** Vercel is fine. The same code structure deploys to Netlify Functions or similar with minimal changes if ever needed.

- **Server-side rendering of the frontend.** Cernita is a static HTML file; no SSR needed.

- **A separate `api/preflight.ts` for CORS preflight handling.** Vercel handles OPTIONS requests if you set headers correctly in each function or use middleware.

- **Combining all backend logic into one function with action routing.** Kader does this for its 12-function limit (`coach-tools.ts` with `?action=` param). Cernita has 4 endpoints; staying split is cleaner. Revisit only if the function count nears 12.

- **GitHub Actions for CI/CD.** Vercel has its own GitHub integration (auto-deploy on push). No additional CI needed.

- **Tests for the API functions.** Real-use testing on a personal project is sufficient. Future spec could add automated tests if the project grows.

## Open questions

- **Q1:** Should the API functions be TypeScript or JavaScript?
  **A:** TypeScript, matching Kader. Vercel handles compilation. The type safety is small but real, and the developer experience matches the user's existing muscle memory.

- **Q2:** Should we use the official `@anthropic-ai/sdk` package, or call the Anthropic API via raw `fetch`?
  **A:** Raw `fetch`. The SDK adds a dependency for what is essentially one HTTP call. The Worker code uses `fetch`; same pattern transfers cleanly. Less dependency surface to maintain.

- **Q3:** Should the household password be hashed at rest in Vercel's env vars?
  **A:** No. Vercel environment variables are encrypted at rest by Vercel. The string we store is the plaintext password the phone sends as a Bearer token; hashing would just add a verification step on every request without improving security.

- **Q4:** Should we support local development via `vercel dev`?
  **A:** Yes. The README documents how to run `vercel dev` locally for testing changes. Standard Kader-pattern.

- **Q5:** Should the repo be public or private on GitHub?
  **A:** User's choice. Either works (no secrets in the repo). Public makes it easier to share the methodology; private keeps the personal-life-context out of public view. Default to private; user can flip later.

- **Q6:** Does the existing `INSTALL.md` get superseded or updated?
  **A:** Updated in place. Phase 1 (Cloudflare Worker setup) is replaced with the Vercel setup steps. Phases 2 and 3 (hosting and per-device install) are updated to reflect the unified Vercel URL. Phase 4 (verification) is unchanged.

- **Q7:** What happens to the deployed Cloudflare Worker (`cernita-proxy.<subdomain>.workers.dev`)?
  **A:** User deletes it from the Cloudflare dashboard once Vercel is verified working. No automatic cleanup. Documented in the migration steps.

- **Q8:** Do we use the Vercel CLI or the Vercel dashboard for setup?
  **A:** Both work. INSTALL.md documents the dashboard-driven flow (visual, one-time, easier for the methodology recap) and mentions the CLI alternative (`vercel env add`, `vercel deploy`) for users who prefer it.

All open questions resolved.

## References

- **Constitution Principle 7** — Architecture serves the user, not the developer (this spec is a course-correction toward Principle 7)
- **Spec dependency:** `/specs/backend-proxy.md` — the authentication model and frontend changes remain valid; this spec only changes the deployment target
- **Kader AI architecture document** — referenced for the Vercel deployment pattern (12 serverless functions, Vercel env vars for secrets, GitHub auto-deploy, custom domain via DNS)
- **Vercel documentation:** Project structure, API routes, environment variables, custom domains
- **Cloudflare Workers documentation:** Referenced only for the migration-out path (delete worker)

## Implementation notes

### Sequencing

This Tier 3 spec ships in three commits, individually testable:

1. `feat(structure): create Vercel project layout, move docs to docs/, rename cernita.html to index.html` — pure file reorganization. App still works locally if opened directly. No deployment yet.

2. `feat(api): create api/anthropic.ts, api/bland.ts, api/bland-status.ts, api/health.ts; vercel.json; package.json` — the actual serverless functions. Test locally with `vercel dev`. Deploy to Vercel preview environment for end-to-end testing.

3. `feat(frontend): update proxy fetch paths from /anthropic/messages to /api/anthropic etc.; relabel "Worker URL" to "Cernita URL"; default to relative paths when same-domain` — frontend changes to point at the new endpoint structure. Verify with both phones against the deployed Vercel URL.

### Sketch: api/anthropic.ts

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyHouseholdAuth, corsHeaders } from './lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cors = corsHeaders(process.env.ALLOWED_ORIGIN || '*');
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();

  const authError = verifyHouseholdAuth(req);
  if (authError) return res.status(authError.status).json(authError.body);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Server misconfigured: ANTHROPIC_API_KEY not set in Vercel environment.'
    });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const responseBody = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
    return res.send(responseBody);
  } catch (err: any) {
    return res.status(500).json({ error: 'Anthropic forward failed', detail: String(err?.message || err) });
  }
}

export const config = {
  maxDuration: 30
};
```

### Sketch: api/lib/auth.ts

```typescript
import type { VercelRequest } from '@vercel/node';

export function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

export function verifyHouseholdAuth(req: VercelRequest): { status: number, body: any } | null {
  const expectedPassword = process.env.HOUSEHOLD_PASSWORD;
  if (!expectedPassword) {
    return {
      status: 500,
      body: { error: 'Server misconfigured: HOUSEHOLD_PASSWORD not set in Vercel environment.' }
    };
  }

  const authHeader = String(req.headers.authorization || '');
  const expected = `Bearer ${expectedPassword}`;
  if (authHeader !== expected) {
    return {
      status: 401,
      body: { error: 'Authentication failed. Check the household password in Settings.' }
    };
  }

  return null;
}
```

### Sketch: vercel.json

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), microphone=(self)" }
      ]
    }
  ],
  "functions": {
    "api/anthropic.ts": { "maxDuration": 30 },
    "api/bland.ts": { "maxDuration": 30 },
    "api/bland-status.ts": { "maxDuration": 10 },
    "api/health.ts": { "maxDuration": 5 }
  }
}
```

### Sketch: package.json

```json
{
  "name": "cernita",
  "version": "1.4.0",
  "private": true,
  "description": "Cernita — moving inventory and decision support tool",
  "scripts": {
    "dev": "vercel dev",
    "deploy": "vercel deploy --prod"
  },
  "devDependencies": {
    "@vercel/node": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

No runtime dependencies — the API functions use only Node's built-in `fetch`.

### Frontend changes (minimal)

In `cernita.html` (renamed to `index.html`):

```javascript
// Before:
async function proxyAnthropicMessages(payload) {
  const response = await proxyFetch('/anthropic/messages', { ... });
}

// After:
async function proxyAnthropicMessages(payload) {
  const response = await proxyFetch('/api/anthropic', { ... });
}
```

Same for the other paths. The `proxyFetch` helper itself doesn't change.

The Settings UI label changes from "Worker URL" to "Cernita URL" with placeholder updated.

### Same-domain default

When the user deploys to Vercel and the frontend and backend are on the same domain (e.g., `https://cernita.vercel.app`), the Cernita URL field can be left blank. The frontend's `proxyFetch` helper defaults to a relative path:

```javascript
function getCernitaUrl() {
  const url = getSetting(STORAGE_KEYS.CERNITA_URL);
  if (!url) return ''; // empty = relative paths, same-domain
  return url.replace(/\/+$/, '');
}

async function proxyFetch(path, init = {}) {
  const baseUrl = getCernitaUrl();
  const fullUrl = baseUrl + path;  // e.g., '/api/anthropic' if baseUrl is empty
  // ...
}
```

This is a small but important UX improvement over the Cloudflare Worker setup, where frontend and backend were always on different domains.

### Migration testing

Manual checklist before merging:

- Project structure created, app loads when opened locally
- `vercel dev` runs locally; `/api/health` responds
- `vercel dev` with valid HOUSEHOLD_PASSWORD authenticates correctly
- Deploy to Vercel preview; URL works in browser
- Configure phone to use the preview URL; AI evaluation works end-to-end
- Translation backfills work
- Bland phone calls work (if BLAND_API_KEY is set)
- Test connection in Settings reports success
- Old Cloudflare Worker can be deleted from Cloudflare dashboard without affecting the new deployment

### What gets deleted

After this spec ships:

- `worker.js` (replaced by `api/anthropic.ts`, `api/bland.ts`, `api/bland-status.ts`, `api/health.ts`)
- `wrangler.toml` (replaced by `vercel.json` and Vercel's auto-detection)
- `DEPLOY-WORKER.md` (replaced by updated `INSTALL.md`)
- The Cloudflare Worker itself in the user's Cloudflare dashboard

What stays:

- `cernita.html` becomes `index.html`, otherwise unchanged
- `CONSTITUTION.md` (moves to `docs/`)
- `PROCESS.md`, `TEMPLATE.md`, `HOW-WE-BUILD.md` (move to `docs/`)
- All specs (move to `specs/`)
- The Supabase database — completely unaffected

### Constitution alignment

This spec is a deliberate course-correction toward Principle 7. The Cloudflare Workers approach optimized for "lowest free-tier cost"; the Vercel approach optimizes for "fits the actual user's existing deployment workflow." For this user, the latter is correct. The principle's wording — "architecture serves the user, not the developer" — is exactly the test that flagged the original direction as wrong.

The spec also serves Principle 8 (honest about limits) by acknowledging in the spec body that the original direction was wrong, why, and what we learned. Future specs should pressure-test architectural decisions against the actual user's existing skills before optimizing for cost or simplicity in the abstract.
