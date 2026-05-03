# Backend proxy for API keys

> Move all API keys (Anthropic, Bland) out of the frontend and behind a tiny Cloudflare Worker that the phones authenticate to with a household-shared password. The user-facing app never sees, stores, or transmits any provider API key.

| | |
|---|---|
| **Status** | shipped (2026-04-28) |
| **Tier** | 3 (substantial — introduces a backend, changes the security model, requires deployment beyond static hosting) |
| **Branch** | `feat/backend-proxy` (merged) |
| **Author** | Cernita team |
| **Drafted** | 2026-04-27 |
| **Last updated** | 2026-04-27 |
| **Constitution principles** | Principle 3 (data lives with the user); Principle 7 (architecture serves the user, not the developer); Principle 9 (safety isn't a feature, it's a default); Principle 8 (honest about limits) |
| **Supersedes** | none, but this is the first feature that materially changes Principle 7's "stack may grow when justified" — the justification is captured below |
| **Depends on** | none in code; depends on user willingness to deploy a Cloudflare Worker |

---

## Problem

Cernita currently stores three sensitive credentials in the browser's localStorage on every user's phone:

1. **Anthropic API key** — pays for AI evaluation. If leaked, anyone can spend the user's Anthropic balance.
2. **Bland.ai API key** — pays for AI phone calls. Same exposure.
3. **Supabase anon key** — less catastrophic (it's intended to be public-ish, with row-level security as the real protection), but still household-scoped.

These keys are entered through Settings text fields, where they're visible briefly during paste. They live in localStorage thereafter, where they're readable by:

- Anyone with physical access to an unlocked phone (5-second copy)
- Browser extensions with the right permissions
- Any malicious script that compromises the page (XSS — defended in code via `escapeHtml()` but not provably impossible)
- A backup of the device that gets compromised
- Anyone who watches over a shoulder during initial setup

This was acceptable when the user model was "one technical adult who understands the implications." It is not acceptable for the actual user model: **two adults of differing technical comfort, one of whom should not have to understand or manage API keys at all.**

Concretely, the user (wife) might:
- Paste the API key into a chat with a friend ("here's the cool app I'm using")
- Take a screenshot of Settings to share with a helper
- Use the app on a borrowed phone and forget to log out
- Lose the phone, with someone finding it before it's wiped
- Mention the household ID + key in a casual message thinking it's a username

Each of these is a normal, reasonable thing for a non-technical user to do. None of them should result in financial loss or system compromise. The current architecture makes that hard to guarantee.

## Why now

Three converging reasons:

1. **The user said so explicitly, twice.** First raised early in the project, raised again as a blocker. Continuing to add features without addressing this would be building on a foundation we already know is wrong.

2. **Constitution Principle 7 was rewritten specifically to allow this.** The original principle ("single HTML file, no build step") was replaced with "Architecture serves the user, not the developer" precisely because we anticipated needing a backend for things like this. This is the first feature that justifies the trade-off Principle 7 was designed to enable.

3. **The cost of waiting compounds.** Every additional feature shipped under the current architecture is one more thing that has to be re-tested when we eventually do this work. Doing it now, with two specs shipped and a clean methodology in place, is dramatically cheaper than doing it after we've shipped onboarding, customs export, location tracking, etc.

## User story

> As the non-technical user (wife), I want to open Cernita on my phone and use it without ever knowing what an API key is. I should be able to type my name once, paste a household URL my partner gives me, type a password we agreed on, and start using the app. If my phone is lost or my screen is shoulder-surfed, no financial harm should be possible. If I accidentally share my screen, the worst that happens is someone could use our shared household quota — not drain anyone's bank account.
>
> As the technical user (husband), I want to manage all the provider credentials in one place, rotate them when needed without touching either phone, see usage logs if I want to, and prevent runaway costs by capping per-household usage. I'm willing to do a one-time deployment setup to get all of this.

## Acceptance criteria

### Frontend changes
- [ ] **AC1** Settings no longer has fields for Anthropic API key or Bland API key. The fields are removed from the UI entirely.
- [ ] **AC2** Settings has a new field: "Worker URL" — the deployed Cloudflare Worker endpoint (e.g., `https://cernita-proxy.example.workers.dev`).
- [ ] **AC3** Settings has a new field: "Household password" — the shared secret both partners agree on. Stored locally; sent in every request to the worker as a Bearer token.
- [ ] **AC4** The Anthropic API key field is removed from localStorage on first launch of the new version, with a one-time toast: "API keys have moved to the proxy backend. See setup guide." (Migration is destructive — the key is purged.)
- [ ] **AC5** All AI evaluation calls go to `${workerUrl}/anthropic/messages` instead of `https://api.anthropic.com/v1/messages`. Authentication via `Authorization: Bearer ${householdPassword}` header.
- [ ] **AC6** All Bland calls go to `${workerUrl}/bland/calls` instead of the Bland endpoint. Same auth pattern.
- [ ] **AC7** The Italian translation backfills (item names + rationales) route through the worker as well.
- [ ] **AC8** The Settings → Connection test verifies that the Worker URL responds with HTTP 200 to a `/health` endpoint, and that the household password authenticates correctly. Errors are clearly distinguishable: bad URL ("Worker not reachable"), wrong password ("Authentication failed"), worker error ("Worker returned 500").
- [ ] **AC9** When the worker returns an authentication error (401), the app prompts the user to check their household password rather than failing silently.
- [ ] **AC10** When the worker is unreachable (network error, DNS failure), the app shows a clear offline state and queues no further requests.
- [ ] **AC11** Supabase URL and anon key remain in Settings unchanged — the database is the user's data, the worker only proxies AI providers.

### Backend (new file: `worker.js`)
- [ ] **AC12** A single Cloudflare Worker file accepts requests at `/anthropic/messages`, `/bland/calls`, `/bland/calls/:id`, and `/health`.
- [ ] **AC13** Every request (except `/health`) requires a valid `Authorization: Bearer ${HOUSEHOLD_PASSWORD}` header. Mismatches return 401 with a clear error message.
- [ ] **AC14** API keys are read from worker environment variables (`ANTHROPIC_API_KEY`, `BLAND_API_KEY`, `HOUSEHOLD_PASSWORD`), never hard-coded.
- [ ] **AC15** Anthropic requests are forwarded with the real API key injected as `x-api-key`. The user's request body is forwarded as-is. The Anthropic response is streamed back to the client.
- [ ] **AC16** Bland requests are forwarded similarly with the Bland key as `Authorization: Bearer`.
- [ ] **AC17** A simple per-household rate limit prevents runaway costs: max 100 Anthropic requests per hour, max 20 Bland calls per day, configurable via env var. Limit hits return 429 with a clear message: "Daily limit reached, resets at TIME."
- [ ] **AC18** CORS headers are set to allow only the user's hosted Cernita origin (configurable via env var, defaults to `*` for first-time setup but should be locked down). Pre-flight OPTIONS handled correctly.
- [ ] **AC19** The `/health` endpoint returns `{ status: "ok", version: "X.Y.Z" }` without authentication, for the connection test.

### Documentation
- [ ] **AC20** A new file `DEPLOY-WORKER.md` provides step-by-step deployment instructions: Cloudflare account setup, Wrangler CLI install, environment variable configuration, deploy command, troubleshooting common errors. Written for a developer audience (the technical partner), not the wife.
- [ ] **AC21** The Settings setup guide in the app is updated. The previous "First-time Setup Guide" steps for entering API keys are replaced with: (1) Get Worker URL from your partner, (2) Enter household password, (3) Test connection. Written for the non-technical partner.

## Data model changes

**Frontend (localStorage keys):**
- REMOVE: `cernita_api_key` (Anthropic key) — purged on first launch of new version
- REMOVE: `cernita_bland_key` (Bland key) — purged on first launch of new version
- ADD: `cernita_worker_url`
- ADD: `cernita_household_password`
- KEEP: `cernita_supabase_url`, `cernita_supabase_key`, `cernita_household_id`, `cernita_user_name`, `cernita_storage_*`, `cernita_user_phone`

**Backend (Cloudflare Worker environment):**
- `ANTHROPIC_API_KEY` (secret) — set via `wrangler secret put`
- `BLAND_API_KEY` (secret, optional if not using calls)
- `HOUSEHOLD_PASSWORD` (secret) — what both phones use to authenticate
- `ALLOWED_ORIGIN` (variable) — the Cernita HTTPS URL, for CORS lockdown
- `RATE_LIMIT_ANTHROPIC_PER_HOUR` (variable, default 100)
- `RATE_LIMIT_BLAND_PER_DAY` (variable, default 20)

**No Supabase schema changes.** The database stays exactly as it is. The proxy only handles AI provider calls.

**Optional v2 enhancement (out of scope):** the worker could log usage to a Supabase table for visibility. Not in this spec.

## UI states

### State A — Settings, fresh user (never connected)
The "API Configuration" section shows two empty fields: Worker URL and Household password. Below them, a "Test connection" button (disabled until both fields have values). Below that, a small instruction note: *"Ask your partner for the worker URL and household password. They set these up once."*

### State B — Settings, connection succeeds
The "Test connection" button turns green briefly, then "✓ Connected. Daily quota: 100 evaluations remaining." The user can now use Evaluate, phone calls, etc.

### State C — Settings, wrong worker URL
"Test connection" fails. Toast: "Worker not reachable. Double-check the URL with your partner." The previous green state (if any) reverts to neutral.

### State D — Settings, wrong household password
"Test connection" fails. Toast: "Authentication failed. The household password may be wrong." Field shakes briefly to draw attention.

### State E — Worker is down or rate-limited mid-use
User taps Evaluate. Worker returns 429 (rate limit) or 503 (down). Result: clear, friendly toast with what's happening: "Daily evaluation limit reached. Resets at 8:00 AM tomorrow." Or: "Service temporarily unavailable. Try again in a few minutes." No spinning forever, no cryptic errors.

### State F — Migration banner (one-time, on first launch of new version)
Top of Evaluate tab shows a single non-dismissible banner: *"⚙ API keys have moved to a backend proxy. Open Settings to enter your worker URL and household password."* The banner stays until both new fields are filled and connection is verified.

### State G — Old API key was in localStorage (existing user)
On first launch of new version: detect `cernita_api_key` exists, purge it, show banner state F. The previous key is gone — user's partner will give them the worker URL and household password.

## Edge cases

- **EC1** User enters worker URL with `http://` instead of `https://`. → Reject with toast: "Worker URL must use HTTPS for security." Don't save.

- **EC2** User enters worker URL with trailing slash. → Auto-strip, save the canonical form. (Avoids double-slash bugs in path concatenation.)

- **EC3** User's worker has been redeployed at a new URL. → Old URL fails connection test. They re-enter the new URL. No data lost — only the URL changed.

- **EC4** Household password gets out of sync between two phones. → One phone works, the other gets 401s. Toast on the broken phone tells the user clearly. Fix is to re-enter the correct password.

- **EC5** Worker key environment variable is missing (deployment error). → Worker returns 500 with a JSON message: `{ "error": "Server misconfigured: ANTHROPIC_API_KEY not set" }`. Frontend shows it verbatim — useful diagnostic for the technical partner.

- **EC6** Worker rate limit hit mid-evaluation. → Anthropic call never made. User sees rate-limit message immediately. No partial state.

- **EC7** Worker is reachable but Anthropic itself is down. → Worker forwards Anthropic's error response. User sees: "AI service temporarily unavailable. Try again in a few minutes."

- **EC8** Network drops mid-request. → Standard fetch error. Same UX as today's network errors. App falls back to offline mode for sync.

- **EC9** User on old version of the app (cached HTML) tries to evaluate after we deploy this change. → Old version still tries to call Anthropic directly with the old localStorage key. If the key is still in localStorage and still valid: works (until they refresh and the new code purges it). If the key has been rotated: fails with the existing error. We accept this as transitional.

- **EC10** Two users on different worker URLs (e.g., partner deployed a new worker and the wife is still pointing at the old one). → Old worker still works until shut down. We document: "When you redeploy, both phones must update the URL in Settings."

- **EC11** Worker accidentally deployed publicly without `HOUSEHOLD_PASSWORD` set. → All requests get 401. Frontend shows clear error. No financial leakage. The worker is "fail-closed" by design.

- **EC12** Anthropic returns a streaming response. → Worker passes the stream through transparently. No buffering. (Cernita's current code doesn't use streaming, but the worker shouldn't preclude it.)

- **EC13** User bookmarks the Cernita HTTPS URL but then the partner takes the worker offline. → Frontend opens normally, settings work normally, but Evaluate fails with the State E error. App is gracefully unusable for AI features but still readable for past entries (Log, Bins, Discuss tabs all work — they only need Supabase, not the worker).

- **EC14** Browser extension blocks third-party requests. → If the worker URL is on a different domain than the Cernita app (likely), some privacy extensions will block it. CORS is set up correctly so this isn't a CORS issue, but extension blocking is a user-environment thing the app can't fix. Document in troubleshooting.

## Out of scope

- **Per-user API quotas within a household.** v1 is per-household quotas only. If we ever want "wife uses max 50/day, husband uses max 80/day," that's a future spec. For now, the household total is the limit.
- **OAuth / proper user accounts.** No "Sign in with Google" flow. The household password model is deliberate: simple, no third-party identity provider, no user accounts to manage.
- **Multi-household support on one worker.** v1 = one worker per household. If a friend wants Cernita too, they deploy their own worker. Future possible spec: a single worker that authenticates multiple households via different passwords, each with its own quota.
- **Logging dashboard.** No UI for "show me what was called when." If we want this later, it's a separate spec involving Supabase or a log-storage solution.
- **Switching providers (e.g., OpenAI instead of Anthropic).** v1 is hardcoded to Anthropic + Bland. Provider abstraction is a future spec.
- **Rotating credentials with zero downtime.** Rotation requires updating the worker env var, then both phones might need to re-test. Acceptable for the volume of rotation expected (essentially never, unless compromise is suspected).
- **Custom domains for the worker.** v1 uses the default `*.workers.dev` domain. If you want `cernita-proxy.yourdomain.com`, configure it yourself in Cloudflare; no app changes needed.
- **Migration tooling for users with existing items.** No data migration is needed. Existing items stay. Only the auth model changes. Users just re-enter their settings on first launch.
- **Non-Cloudflare deployment.** Worker code is small and could be ported to Vercel, Netlify Functions, AWS Lambda, etc. v1 documents Cloudflare only because it's the simplest free option. Porting is straightforward but not in this spec.

## Open questions

- **Q1:** Should the worker proxy Supabase too?
  **A:** No. Supabase has its own per-row authentication via the household ID and row-level security. The anon key being public is intentional in Supabase's design. Adding the worker as a Supabase proxy would add latency for no security benefit.

- **Q2:** Should the household password be hashed before storage in localStorage?
  **A:** No meaningful benefit — anyone reading localStorage can read either the plaintext password or use it directly to authenticate. The worker is the authoritative check. Hashing client-side is security theater here.

- **Q3:** Should we use a JWT instead of a static bearer token?
  **A:** Not for v1. JWTs require expiration and refresh logic; static bearer tokens with HTTPS are sufficient for the threat model. If the password leaks, you rotate it via env var on the worker. Same recovery as a JWT secret rotation.

- **Q4:** Should the rate limits be configurable per-request?
  **A:** No. Hard caps via env vars. If a user wants different limits, they edit the worker env vars. Avoids a settings UI for ops concerns.

- **Q5:** Should we support Anthropic's batch API through the proxy?
  **A:** Not v1. The current app doesn't use batch. If we add batch later (e.g., for backfills), we add the route then.

- **Q6:** Should the worker block specific Anthropic model names (e.g., prevent use of expensive Opus models)?
  **A:** Not v1. The frontend code controls which model is requested. Adding worker-side model whitelisting is operational defense-in-depth that we can add later if costs become an issue.

- **Q7:** Should we offer a hosted shared worker option for users who don't want to deploy their own?
  **A:** Out of scope and probably out of project scope entirely. Cernita is a personal tool, not a SaaS. Hosting a shared worker would mean Anthropic invoicing us for other people's usage — not viable.

All open questions resolved.

## References

- **Constitution Principle 3** — Data lives with the user
- **Constitution Principle 7** — Architecture serves the user, not the developer (this PR is the first major exercise of this principle)
- **Constitution Principle 8** — Honest about limits (deployment friction is acknowledged in DEPLOY-WORKER.md)
- **Constitution Principle 9** — Safety isn't a feature, it's a default (key removal is a safety improvement)
- **Cloudflare Workers documentation** — `developers.cloudflare.com/workers/`
- **Wrangler CLI** — `developers.cloudflare.com/workers/wrangler/`
- **Existing user concern** — raised twice in conversation, including "My wife may expose the key by accident as she would not understand the impact"

## Implementation notes

### File structure after this PR

```
/cernita.html                    — frontend (modified)
/worker.js                       — new: the Cloudflare Worker
/wrangler.toml                   — new: Cloudflare deployment config
/DEPLOY-WORKER.md                — new: deployment guide
/specs/backend-proxy.md          — this spec
```

### Worker.js sketch (informal — not the full implementation)

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env.ALLOWED_ORIGIN || '*');

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/health') return json({ status: 'ok' }, cors);

    // Authenticate
    const auth = request.headers.get('Authorization') || '';
    const expected = `Bearer ${env.HOUSEHOLD_PASSWORD}`;
    if (auth !== expected) return json({ error: 'Authentication failed' }, cors, 401);

    // Rate limit
    const rateLimitOk = await checkRateLimit(url.pathname, env);
    if (!rateLimitOk) return json({ error: 'Rate limit exceeded' }, cors, 429);

    // Route
    if (url.pathname === '/anthropic/messages') {
      return forwardToAnthropic(request, env, cors);
    }
    if (url.pathname.startsWith('/bland/')) {
      return forwardToBland(request, url, env, cors);
    }

    return json({ error: 'Not found' }, cors, 404);
  }
};
```

### Frontend changes

1. **Remove the API key field group from Settings.** Replace the entire "Anthropic API Key" and "Bland.ai API Key" sections with a new "Backend connection" section containing Worker URL + Household password fields.

2. **Update STORAGE_KEYS constant.** Remove `API_KEY` and `BLAND_KEY`. Add `WORKER_URL` and `HOUSEHOLD_PASSWORD`.

3. **Update fetch calls.** Find every `https://api.anthropic.com` and replace with `${getSetting(STORAGE_KEYS.WORKER_URL)}/anthropic`. Same for Bland endpoints.

4. **Update the auth header.** Currently: `'x-api-key': apiKey`. New: `'Authorization': 'Bearer ' + getSetting(STORAGE_KEYS.HOUSEHOLD_PASSWORD)`.

5. **Add migration logic.** On first launch with the new code, check for old localStorage keys. If found, delete them and show the migration banner.

6. **Update the connection test** to call `${workerUrl}/health` first (no auth), then a low-cost auth-required ping (e.g., a 1-token Anthropic call) to verify password.

7. **Update setup guide in Settings tab.** The non-technical partner sees: enter worker URL, enter household password, tap test, done.

### Rate limiting implementation note

Worker rate limits use Cloudflare's KV or Durable Objects. For simplicity in v1, KV is fine: store counters keyed by `${endpoint}:${currentHour}` with a TTL of 1 hour. Increment on each request. Reject when over the limit.

### Deployment guide outline (for `DEPLOY-WORKER.md`)

```
1. Create Cloudflare account (free)
2. Install Node.js if not already (required for Wrangler)
3. Install Wrangler: npm install -g wrangler
4. Login: wrangler login (browser opens)
5. Clone or download Cernita repo
6. cd into project, run: wrangler init (or use provided wrangler.toml)
7. Set secrets:
   wrangler secret put ANTHROPIC_API_KEY
   wrangler secret put BLAND_API_KEY  (optional)
   wrangler secret put HOUSEHOLD_PASSWORD
8. Deploy: wrangler deploy
9. Note the deployed URL (something.workers.dev)
10. Open Cernita on phone, paste URL and password into Settings, test
11. Repeat step 10 on wife's phone
```

### Migration testing

Before merging, manually test:
- Fresh install: works as expected
- Upgrade from current version with old key in localStorage: key gets purged, banner shows, user re-enters worker URL + password, works
- Two phones with different states (one upgraded, one not): both should work, just with different setup flows

### Constitution alignment

This PR is a deliberate, justified violation of the original Principle 7 ("single file, no build step"). It conforms to the revised Principle 7 ("architecture serves the user, not the developer") because:
- The user-facing simplicity *increases* (3 fields instead of 5+)
- The user-facing safety *increases* (no exposed credentials)
- The complexity is absorbed by the technical partner during one-time setup
- Once deployed, ongoing operations are simple

This is exactly the kind of architectural growth Principle 7 was rewritten to allow.
