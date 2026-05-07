# Spec 017 — Security, Safety & Code Quality

**Status:** approved
**Tier:** 1 — cross-cutting (applies to all features)
**Depends on:** 009 (authentication), 010 (stack/architecture)
**Constitution alignment:** P3 (data ownership), P4 (two-person sync), P7 (architecture serves the user), P9 (safety as default), P10 (specs over code)

---

## 1. Purpose

This specification defines the security posture, safety requirements, and code quality standards for Cernita. It serves two functions:

1. **Internal governance** — concrete, testable requirements that every feature must satisfy before shipping.
2. **External defensibility** — an auditable record that this application was built with intentional security design, not default framework behavior.

Cernita is built using AI-assisted development (Claude Code / Anthropic Claude). This spec explicitly addresses the quality controls that govern AI-generated code, establishing that the development process includes verification, traceability, and human oversight at every decision point.

---

## 2. Scope

### In scope

- Authentication and session management
- Data classification and protection
- API security (server-side and client-side)
- AI integration security (prompt handling, output validation)
- HTTP transport and header security
- Dependency management and supply chain
- Code quality gates and development process
- OWASP Top 10 (2021) mapping
- AI-assisted development governance

### Out of scope

- Physical device security (phone loss, screen lock — user's responsibility)
- Supabase infrastructure security (managed service; covered by Supabase's own SOC 2 Type II)
- Vercel platform security (managed service; covered by Vercel's SOC 2 Type II)
- Anthropic API security (managed service; covered by Anthropic's security practices)
- Nation-state adversaries, advanced persistent threats
- Social engineering attacks against the two users
- Regulatory compliance beyond Italian customs (D.P.R. 43/1973, EU Reg. 1186/2009)

---

## 3. Threat Model

### 3.1 Data Classification

| Classification | Data | Storage | Sensitivity |
|---------------|------|---------|-------------|
| **Personal identity** | Legal names, DOB, nationality | Supabase (customs profile in localStorage) | High |
| **Home addresses** | US residence, Italian destination | Supabase + localStorage | High |
| **Financial estimates** | Resale values, replacement costs, shipping costs | Supabase | Medium |
| **Household photos** | Base64 JPEG of possessions | Supabase (`photo_data` column) | Medium |
| **Inventory metadata** | Item names, weights, decisions, rationales | Supabase | Low–Medium |
| **App settings** | Rates, thresholds, rules, preferences | localStorage (per browser) | Low |
| **Auth credentials** | Session tokens, refresh tokens | localStorage (managed by Supabase SDK) | Critical |
| **API keys** | `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel environment variables (server-side only) | Critical |

### 3.2 Threat Actors

| Actor | Motivation | Capability | Likelihood |
|-------|-----------|------------|------------|
| **Opportunistic attacker** | Financial data, identity theft | Script-level web attacks (XSS, CSRF, credential stuffing) | Medium |
| **Lost/stolen phone** | Access to active session | Physical device access with unlocked browser | Medium |
| **Malicious browser extension** | Data exfiltration | DOM access, localStorage read, network interception | Low |
| **Supabase data breach** | Bulk data access | Database dump (mitigated by Supabase's own security) | Low |
| **Rogue npm dependency** | Supply chain attack | Code execution in build or runtime | Low |
| **Prompt injection via description** | Manipulate AI output | Crafted text input to evaluation endpoint | Low (self-attack only) |

### 3.3 Assets to Protect

1. **Authentication integrity** — only the two household members can access the app
2. **Data confidentiality** — personal identity, addresses, and photos are not exposed to unauthorized parties
3. **API key secrecy** — server-side keys never reach the client
4. **Decision integrity** — AI recommendations cannot be silently altered; user always has final say (Constitution P1)
5. **Data portability** — user can always export and delete their data (Constitution P3)

---

## 4. Security Requirements

### 4.1 Authentication & Authorization

| ID | Requirement | Verification |
|----|------------|--------------|
| SEC-AUTH-01 | All pages except `/login` are wrapped in `AuthGuard` — unauthenticated users are redirected to login | Code review: every page file imports and wraps with `AuthGuard` |
| SEC-AUTH-02 | `AuthGuard` uses `authLoading` flag — never redirects while auth state is still initializing | Code review: `AuthGuard` checks `authLoading` before redirect |
| SEC-AUTH-03 | All API routes call `requireAuth(req, res)` as their first operation — returns 401 if auth fails | Code review: every file in `pages/api/` starts with `requireAuth` |
| SEC-AUTH-04 | `requireAuth` validates the Bearer token via `supabase.auth.getUser()` — does not trust the token at face value | Code review: `lib/auth.ts` calls `getUser()` not `getSession()` |
| SEC-AUTH-05 | Supabase self-registration is disabled — new accounts require admin action in the Supabase dashboard | Deployment checklist: verify in Supabase → Auth → Settings |
| SEC-AUTH-06 | RLS policy on all tables enforces `auth.uid() IS NOT NULL` — no anonymous access to any table | SQL review: verify RLS policies on `cernita_entries`, `cernita_boxes`, `cernita_locations`, `cernita_trips` |
| SEC-AUTH-07 | Session tokens are managed by `@supabase/supabase-js` with `autoRefreshToken: true` — no custom token handling | Code review: `lib/supabase.ts` configuration |
| SEC-AUTH-08 | Sign-out clears the Supabase session and redirects to `/login` | Manual test |

### 4.2 Data Protection

| ID | Requirement | Verification |
|----|------------|--------------|
| SEC-DATA-01 | All client–server communication uses HTTPS (TLS 1.2+) — enforced by Vercel and Supabase | Infrastructure verification |
| SEC-DATA-02 | No PII is stored in `localStorage` except: Supabase session token (managed by SDK), customs declarant profile (names, DOB, addresses within `CernitaSettings`), and app settings | Code grep: audit all `localStorage.setItem` calls |
| SEC-DATA-03 | Photos are stored as base64 in the Supabase `photo_data` column — never written to Vercel's filesystem, `/tmp`, or any CDN | Code review: `pages/api/anthropic.ts` does not write `photoBase64` to disk |
| SEC-DATA-04 | The data deletion flow (Settings → "Delete all my data") deletes entries, boxes, trips, and locations from Supabase, clears localStorage, and signs out | Manual test: verify all tables are empty after deletion |
| SEC-DATA-05 | CSV export contains item data only — no auth tokens, API keys, or session data in exported files | Code review: `lib/exportCsv.ts` field list |
| SEC-DATA-06 | Print-to-PDF pages (`/distinta`, `/export/inventory`, `/manifest/[id]`, `/labels`) do not trigger network requests on load — they render from in-memory state only | Code review: no `fetch` or `supabase` calls in print page components |

### 4.3 API Security

| ID | Requirement | Verification |
|----|------------|--------------|
| SEC-API-01 | `ANTHROPIC_API_KEY` is a server-side environment variable — never included in the client JavaScript bundle | Build verification: search `.next/static` output for the key pattern |
| SEC-API-02 | `SUPABASE_SERVICE_ROLE_KEY` (if used) is server-side only — the client uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` exclusively | Code grep: `SERVICE_ROLE` never appears in `lib/` or `pages/` (only in `lib/auth.ts` if applicable) |
| SEC-API-03 | The `/api/anthropic` endpoint validates the request body structure — rejects requests without `photoBase64` or `description` | Code review: input validation in `pages/api/anthropic.ts` |
| SEC-API-04 | AI response parsing uses `JSON.parse` inside a try/catch — malformed AI output returns a 500 error, never crashes the server | Code review: JSON parse is wrapped in try/catch |
| SEC-API-05 | The client-side fetch to `/api/anthropic` has a 90-second timeout via `AbortController` — prevents indefinite hangs | Code review: `pages/evaluate.tsx` timeout implementation |
| SEC-API-06 | API routes return generic error messages to the client — internal error details are logged server-side only via `console.error` | Code review: error responses use generic messages |

### 4.4 AI Integration Security

| ID | Requirement | Verification |
|----|------------|--------------|
| SEC-AI-01 | The AI receives only: the photo (if provided), the text description (if provided), and rate settings — no auth tokens, user identity, or database contents are sent to the AI | Code review: `pages/api/anthropic.ts` request body construction |
| SEC-AI-02 | The AI has no write access to the database — it returns a JSON recommendation; the client decides whether to save it | Architecture review: AI endpoint returns data; insert happens in `pages/evaluate.tsx` via separate Supabase call |
| SEC-AI-03 | AI output is validated before use: unknown `final_decision` values are replaced with `NEEDS-HUMAN` and logged | Code review: `VALID_DECISIONS` guard in `pages/evaluate.tsx` |
| SEC-AI-04 | The AI prompt is constructed server-side — the client cannot inject arbitrary system-level instructions | Code review: prompt template is in `pages/api/anthropic.ts`, not user-editable |
| SEC-AI-05 | User-provided description text is included in the prompt as a clearly delimited field (`Item description: ${description}`) — not concatenated into system instructions | Code review: description placement in prompt |
| SEC-AI-06 | The AI model selection is user-configurable (`settings.aiModel`) but restricted to Anthropic Claude models — no arbitrary model endpoint injection | Code review: model string passed to `anthropic.messages.create()` — Anthropic SDK validates |

### 4.5 HTTP Security Headers

| ID | Requirement | Status | Verification |
|----|------------|--------|--------------|
| SEC-HDR-01 | `Strict-Transport-Security: max-age=63072000; includeSubDomains` | **Gap — not configured** | `next.config.mjs` headers |
| SEC-HDR-02 | `X-Content-Type-Options: nosniff` | Vercel default ✅ | Response header check |
| SEC-HDR-03 | `X-Frame-Options: DENY` | **Gap — not configured** | `next.config.mjs` headers |
| SEC-HDR-04 | `Referrer-Policy: strict-origin-when-cross-origin` | **Gap — not configured** | `next.config.mjs` headers |
| SEC-HDR-05 | `Permissions-Policy: camera=(self), microphone=(), geolocation=()` | **Gap — not configured** | `next.config.mjs` headers |
| SEC-HDR-06 | `Content-Security-Policy` with `default-src 'self'; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co` | **Gap — not configured** | `next.config.mjs` headers |

> **Action required:** SEC-HDR-01, -03, -04, -05, -06 must be added to `next.config.mjs` as `headers()` configuration. See §8 Implementation.

### 4.6 Dependency Security

| ID | Requirement | Verification |
|----|------------|--------------|
| SEC-DEP-01 | Production dependencies are limited to: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@anthropic-ai/sdk` — any addition requires documented justification referencing Constitution P7 | `package.json` review |
| SEC-DEP-02 | `npm audit` must report no critical or high vulnerabilities before deployment | CI/CD gate or manual check |
| SEC-DEP-03 | No dependency requires `postinstall` scripts that execute arbitrary code | `package.json` and dependency `package.json` review |
| SEC-DEP-04 | `@supabase/ssr` is explicitly excluded — it causes `navigator.locks` contention on mobile browsers and was removed in commit `87f52f0` | `package.json` must not contain `@supabase/ssr` |

---

## 5. Code Quality Gates

This section defines the verification process that governs all code in Cernita, whether written by a human or generated by AI. The purpose is not to argue that AI-generated code is inherently safe or unsafe — it is to establish that **every line of shipped code passes through specific, auditable quality controls** that most software projects (human-written or otherwise) do not enforce.

### 5.1 Development Process

| Gate | Description | When | Evidence |
|------|------------|------|----------|
| **Spec-first** | Every feature has an approved specification before implementation begins. The spec defines acceptance criteria, edge cases, and out-of-scope boundaries. | Before any code | `.specify/specs/NNN-feature/spec.md` exists |
| **Constitution check** | Every implementation is checked against the 13 constitutional principles. Violations block the commit. | During implementation | Constitution referenced in commit messages and PR descriptions |
| **Type safety** | All code is TypeScript with strict null checks. `npx tsc --noEmit` must pass with zero errors. | Before every commit | CI output or local build log |
| **Build gate** | `npx next build` must complete successfully. No warnings treated as errors, but type errors and import errors block the build. | Before every commit | Build output |
| **Defensive coding** | Null guards on all external data (AI responses, Supabase results, URL params). Fallback chains for display values. Error boundaries on async operations. | Code review | Pattern presence in diff |
| **Commit traceability** | Every commit message references the spec it implements. Every PR includes a summary of changes and test plan. | At commit time | Git log |
| **Manual test** | Features are tested on two physical phones (the actual deployment target) before being marked as shipped. | After deployment | User confirmation |

### 5.2 AI-Assisted Development Governance

Cernita is developed using Claude Code (Anthropic) as a pair-programming tool. The following controls govern this process:

| Control | Description |
|---------|------------|
| **Human specification authority** | The AI does not write specs. All specifications are authored or approved by a human. The AI implements approved specs. |
| **Human architectural authority** | Stack decisions (Next.js 14, Supabase, no Tailwind, CSS custom properties) are human decisions documented in the Constitution. The AI operates within these constraints. |
| **No blind acceptance** | AI-generated code is reviewed before commit. The build gate (`tsc --noEmit` + `next build`) catches type errors, broken imports, and structural issues that a human reviewer might miss. |
| **Explicit error on unknown** | When the AI encounters an ambiguous requirement, it must flag it as `NEEDS CLARIFICATION` (in plans) or `NEEDS-HUMAN` (in runtime decisions) — never guess silently. This principle applies to both the development AI and the in-app evaluation AI. |
| **Constitution override** | The AI cannot override constitutional principles. If generated code violates a principle (e.g., hiding cost math from the user — P2 violation), it is rejected regardless of correctness. |
| **Dependency justification** | The AI cannot add npm packages without human approval. Each dependency must be justified against Constitution P7 ("architecture serves the user, not the developer"). |
| **Audit trail** | All AI-assisted sessions produce a transcript. Commits include `Co-Authored-By: Claude` attribution. The spec → plan → commit chain is traceable. |

### 5.3 What AI-Assisted Development Does NOT Mean

For external reviewers, it is important to clarify what this development process is and is not:

1. **It is not unreviewed code generation.** Every feature goes through: spec authorship (human) → implementation (AI + human) → type check (automated) → build verification (automated) → manual test (human) → deployment decision (human).

2. **It is not "vibe coding."** The constitutional framework, spec-first workflow, and type system constrain the AI to implementing defined behavior — not inventing features or making architectural decisions autonomously.

3. **It is not less secure than typical development.** The OWASP mapping (§6), type safety enforcement, and dependency controls exceed what most early-stage applications implement, regardless of whether the code was human-written or AI-assisted.

4. **It is not a black box.** Every line of code is in a version-controlled repository with full commit history, spec references, and attributed authorship. There is no compiled binary or obfuscated output.

---

## 6. OWASP Top 10 (2021) Mapping

This section maps each OWASP Top 10 category to Cernita's specific controls.

### A01 — Broken Access Control

| Risk | Cernita control | Status |
|------|----------------|--------|
| Unauthenticated page access | `AuthGuard` on every page; `authLoading` prevents premature redirect | ✅ Implemented |
| Unauthenticated API access | `requireAuth()` on every API route | ✅ Implemented |
| Horizontal privilege escalation | Not applicable — both users share all data (Constitution P4). RLS is `auth.uid() IS NOT NULL`. | ✅ By design |
| Vertical privilege escalation | No admin roles exist. Supabase dashboard is the only admin interface. | ✅ By design |
| CORS misconfiguration | Single-origin deployment on Vercel; no custom CORS headers needed | ✅ By design |

### A02 — Cryptographic Failures

| Risk | Cernita control | Status |
|------|----------------|--------|
| Data in transit | HTTPS enforced by Vercel (TLS 1.2+) and Supabase | ✅ Platform-provided |
| Data at rest | Supabase PostgreSQL encryption (managed) | ✅ Platform-provided |
| Custom cryptography | None used — no custom hashing, encryption, or token generation | ✅ Not applicable |
| Sensitive data in URLs | No PII in URL parameters or query strings | ✅ Verified |

### A03 — Injection

| Risk | Cernita control | Status |
|------|----------------|--------|
| SQL injection | All database queries use Supabase client SDK (parameterized) — no raw SQL in application code | ✅ By design |
| XSS via AI output | AI output is rendered as text content via React (auto-escaped), not `dangerouslySetInnerHTML` | ✅ By design |
| XSS via user input | Description field rendered as text; no HTML parsing of user input anywhere | ✅ Verified |
| Prompt injection | User description is the only untrusted input to the AI prompt. It is appended as a delimited field, not injected into system instructions. Impact is limited to receiving a wrong evaluation — the user confirms or overrides every result (P1). | ⚠️ Accepted risk |

### A04 — Insecure Design

| Risk | Cernita control | Status |
|------|----------------|--------|
| Missing threat model | This document (§3) | ✅ This spec |
| No abuse case analysis | Threat actors defined in §3.2 | ✅ This spec |
| Business logic flaws | Spec-first workflow with acceptance criteria and edge cases | ✅ Process control |

### A05 — Security Misconfiguration

| Risk | Cernita control | Status |
|------|----------------|--------|
| Default credentials | No default passwords. Supabase auth is email+password with admin-controlled registration. | ✅ By design |
| Unnecessary features enabled | Minimal Next.js config (`reactStrictMode: true`). No unused API routes. | ✅ Verified |
| Missing security headers | HSTS, X-Frame-Options, CSP, Permissions-Policy, Referrer-Policy | ❌ **Gap — see §4.5** |
| Stack traces in production | Next.js API routes return generic error messages; details logged server-side | ✅ Verified |
| Verbose error messages | Client receives `"AI unavailable"`, `"Session expired"`, etc. — never stack traces or internal paths | ✅ Verified |

### A06 — Vulnerable and Outdated Components

| Risk | Cernita control | Status |
|------|----------------|--------|
| Known vulnerabilities | `npm audit` before deployment (SEC-DEP-02) | ✅ Process control |
| Dependency sprawl | 5 production dependencies, each justified (SEC-DEP-01) | ✅ Minimal surface |
| Outdated framework | Next.js 14.2.x, React 18, TypeScript 5 — all current LTS | ✅ Current |

### A07 — Identification and Authentication Failures

| Risk | Cernita control | Status |
|------|----------------|--------|
| Credential stuffing | Supabase Auth handles rate limiting and lockout | ✅ Platform-provided |
| Weak password policy | Supabase Auth default minimum (6 characters). Consider strengthening. | ⚠️ Acceptable for 2-user app |
| Session fixation | Supabase SDK manages token rotation and refresh | ✅ Platform-provided |
| Missing MFA | Not implemented. Acceptable for a 2-user household app with no financial transactions. | ⚠️ Accepted risk |

### A08 — Software and Data Integrity Failures

| Risk | Cernita control | Status |
|------|----------------|--------|
| Unsigned updates | Vercel deployment from Git — no unsigned binary delivery | ✅ By design |
| Deserialization attacks | `JSON.parse` in try/catch; no `eval()`, no `Function()` constructor | ✅ Verified |
| CI/CD compromise | GitHub → Vercel pipeline; no custom CI scripts | ✅ Platform-provided |
| Data integrity | `rules_version` tracking detects entries calculated with outdated rates; re-derive flow available | ✅ Implemented |

### A09 — Security Logging and Monitoring Failures

| Risk | Cernita control | Status |
|------|----------------|--------|
| No logging | Server-side: `console.error` in API routes (visible in Vercel logs). Client-side: `[eval]` prefixed breadcrumbs for debugging. | ⚠️ Minimal but adequate |
| No alerting | No automated alerting on auth failures or API errors. Acceptable for 2-user app — both users are the operators. | ⚠️ Accepted risk |
| Insufficient audit trail | Git commit history + Vercel deployment logs + Supabase audit log (if enabled) | ✅ Adequate |

### A10 — Server-Side Request Forgery (SSRF)

| Risk | Cernita control | Status |
|------|----------------|--------|
| User-controlled URLs | No API route fetches a URL provided by the user. The only outbound call is to `anthropic.messages.create()` with a fixed SDK endpoint. | ✅ Not applicable |
| Internal network access | Vercel serverless functions have no access to internal networks | ✅ Platform-provided |

---

## 7. Acceptance Criteria

### Security implementation (must pass before production)

- [ ] AC-01: All SEC-AUTH requirements (01–08) verified via code review
- [ ] AC-02: All SEC-DATA requirements (01–06) verified via code review
- [ ] AC-03: All SEC-API requirements (01–06) verified via code review
- [ ] AC-04: All SEC-AI requirements (01–06) verified via code review
- [ ] AC-05: Security headers (SEC-HDR-01 through -06) configured in `next.config.mjs` and verified via response header inspection
- [ ] AC-06: `npm audit` reports no critical or high vulnerabilities
- [ ] AC-07: `npx tsc --noEmit` passes with zero errors
- [ ] AC-08: `npx next build` passes successfully
- [ ] AC-09: Production deployment uses HTTPS (verified via browser)
- [ ] AC-10: `ANTHROPIC_API_KEY` does not appear in client-side JavaScript (verified via browser DevTools → Sources)

### Code quality (ongoing — every commit)

- [ ] AC-11: Every shipped feature has a spec in `.specify/specs/`
- [ ] AC-12: Every commit references a spec or issue
- [ ] AC-13: TypeScript strict mode — no `any` types without documented justification
- [ ] AC-14: No `dangerouslySetInnerHTML` without documented justification and sanitization
- [ ] AC-15: No `eval()`, `Function()`, or dynamic code execution

### Data protection (verified manually)

- [ ] AC-16: Sign out clears session and redirects to login
- [ ] AC-17: "Delete all my data" removes all entries, boxes, trips, locations from Supabase, clears localStorage, and signs out
- [ ] AC-18: CSV export contains only item data fields — no tokens, keys, or session data
- [ ] AC-19: Print pages render without network requests (work offline after initial load)

---

## 8. Implementation — Security Headers

Add to `next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

> **Note:** `'unsafe-eval'` in `script-src` is required by Next.js development mode. For production-only hardening, consider removing it via environment-conditional logic. `'unsafe-inline'` is required for Next.js inline styles and Supabase SDK.

---

## 9. Risk Acceptance Register

The following risks are acknowledged and accepted given Cernita's threat profile (2-user household app, no financial transactions, no third-party data):

| Risk | OWASP | Severity | Rationale for acceptance |
|------|-------|----------|------------------------|
| No MFA | A07 | Low | 2-user household; no financial transactions; Supabase handles rate limiting |
| Minimal logging/alerting | A09 | Low | Both users are the operators; Vercel logs available for debugging |
| Prompt injection in description field | A03 | Low | Self-attack only (users enter their own descriptions); impact limited to wrong evaluation; user confirms every result |
| Supabase password policy (6 char minimum) | A07 | Low | Admin-controlled registration; only 2 accounts exist |
| localStorage for customs PII | — | Medium | Customs profile (names, DOB, addresses) stored in localStorage for offline access. Mitigated by: data is on user's own device, sign-out does not clear settings (intentional — Constitution P3), deletion flow clears all. |

---

## 10. Review Schedule

| Review | Frequency | Reviewer |
|--------|-----------|----------|
| Dependency audit (`npm audit`) | Before each deployment | Developer |
| Security header verification | After `next.config.mjs` changes | Developer |
| OWASP mapping review | Quarterly or after major feature addition | Developer + external reviewer (if available) |
| Constitution alignment check | Every spec review | Developer |
| Supabase RLS policy review | After any migration that adds a table | Developer |

---

## 11. References

- [OWASP Top 10 (2021)](https://owasp.org/Top10/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security) — Row Level Security, Auth, encryption at rest
- [Vercel Security](https://vercel.com/security) — SOC 2 Type II, TLS, serverless isolation
- [Anthropic Usage Policy](https://www.anthropic.com/policies/usage-policy) — data handling for API calls
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [CWE-79](https://cwe.mitre.org/data/definitions/79.html) — Cross-site Scripting (addressed by React auto-escaping)
- [CWE-89](https://cwe.mitre.org/data/definitions/89.html) — SQL Injection (addressed by Supabase parameterized queries)
- [CWE-200](https://cwe.mitre.org/data/definitions/200.html) — Information Exposure (addressed by generic error messages)
- [CWE-352](https://cwe.mitre.org/data/definitions/352.html) — CSRF (addressed by Bearer token auth, not cookies)
- Cernita Constitution v1.5 (`.specify/memory/constitution.md`)
- Spec 009 — Authentication & Household Identity
- Spec 010 — Stack & Architecture
