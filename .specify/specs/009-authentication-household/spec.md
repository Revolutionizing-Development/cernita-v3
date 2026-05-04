# Authentication and household

> Two people, one app, normal login. The technical partner creates both accounts during deployment. No registration, no household ID fields, no infrastructure visible to either user. Supabase Auth handles sessions; the backend handles everything else.

| | |
|---|---|
| **Status** | draft |
| **Tier** | 4 (major — replaces the authentication model, changes every API call path, affects all existing specs) |
| **Branch** | `feat/authentication-household` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-05-03 |
| **Last updated** | 2026-05-03 |
| **Constitution principles** | Principle 3 (data belongs to the user — requires amendment 002); Principle 4 (two people, one truth); Principle 7 (architecture serves the user, not the developer); Principle 9 (safety as default) |
| **Supersedes** | Replaces the authentication model from `/specs/003-backend-proxy/spec.md` and the frontend Settings fields from `/specs/004-vercel-deployment/spec.md`. Both specs' feature-level behavior (AI proxy, bilingual output, etc.) remains valid. |
| **Depends on** | Amendment 002 (Principle 3 revision) must be accepted first |

---

## Problem

The previous Cernita required users to configure infrastructure through Settings fields:

1. **Supabase URL** — a database endpoint pasted into a text field
2. **Supabase anon key** — a credential pasted into a text field
3. **Household ID** — a string typed by hand
4. **Household password** (after backend proxy) — shared secret typed into Settings
5. **Cernita URL / Worker URL** — the backend endpoint pasted into Settings

Five fields of infrastructure that the non-technical partner should never see. This was the direct cause of the stalled deployment — not a code bug, but a UX model that violated Principle 7 from the start.

Three concrete failures this caused:

**1. Onboarding friction killed momentum.** Setting up the wife's phone required a 15-minute walkthrough: "paste this URL, now paste this key, now type this ID, now type this password, now tap test." One wrong character in any field and nothing works, with error messages that reference infrastructure ("Supabase returned 401") rather than user actions ("check your password").

**2. The household concept leaked implementation.** "Household" in Cernita means two people making decisions together. In the database it became a `household_id` string that had to match between phones, typed by hand, with no validation that both phones used the same one. Two people could silently end up in different households if one mistyped the ID.

**3. Settings became a minefield.** The Settings tab mixed user preferences (name, storage rate, shipping rate) with infrastructure (URLs, keys, passwords). The non-technical partner had to navigate past database credentials to change their display name.

## Why now

This is the rebuild. Every other spec in the project assumes some form of authentication and data access pattern. Building features on the old model means building them wrong and rebuilding again later. Authentication is the foundation — it ships first.

## User story

> As the non-technical partner, I open Cernita on my phone for the first time. I see a login screen — just email and password, the same as every other app I use. My partner already told me the password; I type it in and I'm in. I see my name in the corner. I start evaluating items.
>
> I never see a database URL. I never see an API key. I never type a "household ID." I never configure a "worker URL." The app just works.
>
> As the technical partner, I deploy Cernita once (Vercel + Supabase, same as Kader AI). During setup, I create two user accounts in Supabase Auth — one for me, one for my wife. I set our display names. I share the password with her. Done. No configuration beyond what Vercel and Supabase already require.

## Design decisions

### Why hardcoded two users, not a registration flow

Cernita is for exactly two people doing one move. There is no third user. There is no "invite a friend." There is no "create a new household." Adding registration means adding:

- Email verification flow
- Password reset flow
- "Create household" / "join household" UX
- Invitation system
- Edge cases around orphaned households, single-user households, multi-household users

All of this infrastructure serves zero users. The two people who will use this app are known in advance. Their accounts are created by the person who deploys the app. This is the simplest correct solution.

### Why Supabase Auth, not custom auth

Supabase Auth is already in the stack (Supabase is the database). It provides:

- Email/password authentication with bcrypt hashing
- JWT session tokens that the frontend can store and refresh
- Row Level Security (RLS) integration — the database knows who's asking
- Built-in token refresh, session expiry, and logout

Building custom auth on top of Supabase would mean reimplementing what Supabase Auth already does. Principle 7: architecture serves the user, not the developer. Using the tool that's already there serves both.

### Why no household_id column

The previous schema used `household_id` on every table to support multi-tenancy. But Cernita is single-tenant — one deployment, one household, one database. The `household_id` column was infrastructure for a multi-tenant future that will never arrive.

Removing it simplifies:
- Every query (no `WHERE household_id = ?` on every call)
- Every RLS policy (just check `auth.uid()` exists, not that it matches a household)
- Every migration (no foreign key to a households table)
- Every API endpoint (no household parameter to validate)

If someone forks Cernita for their own move, they deploy their own instance. That's the multi-tenancy model: one deployment per household, not one database per many households.

## Acceptance criteria

### Authentication flow

- [ ] **AC1** The app opens to a login screen when no active session exists. Two fields: email and password. One button: "Accedi · Sign in". No registration link, no "forgot password" link (the technical partner handles both via Supabase dashboard or CLI).

- [ ] **AC2** On successful login, the app navigates to the Evaluate tab. The user's display name (from Supabase Auth `user_metadata.display_name`) appears in the app header or Settings.

- [ ] **AC3** On failed login (wrong email or password), a clear error: "Email o password non validi · Invalid email or password." No infrastructure details in the error.

- [ ] **AC4** Sessions persist across browser closes and app reopens via Supabase Auth's JWT refresh token stored in an httpOnly cookie (if backend-managed) or in-memory with refresh (if client-managed). The user does not re-login unless the session expires or they explicitly log out.

- [ ] **AC5** A "Sign out · Esci" button in Settings ends the session and returns to the login screen.

- [ ] **AC6** Session tokens are sent to the Vercel API routes as `Authorization: Bearer <token>`. The backend validates the token with Supabase Auth before processing any request.

### Account setup (deployment time)

- [ ] **AC7** During deployment, the technical partner creates two users via the Supabase dashboard (Authentication → Users → Add user) or via the Supabase CLI. Each user has: email, password, and `display_name` in `user_metadata`.

- [ ] **AC8** No `cernita_users` table, no `cernita_households` table. User identity comes from Supabase Auth's `auth.users` table. Display name comes from `user_metadata.display_name`.

- [ ] **AC9** The Supabase project's auth settings disable self-registration (Settings → Authentication → "Enable sign ups" = off). Only the two pre-created accounts can log in.

### Database changes

- [ ] **AC10** All existing tables (`cernita_entries`, `cernita_boxes`, `cernita_locations`, `cernita_trips`, `cernita_calls`) drop the `household_id` column. Data is implicitly single-household.

- [ ] **AC11** All tables gain a `created_by uuid references auth.users(id)` column (nullable for backward compatibility during migration). New entries record which user created them.

- [ ] **AC12** Row Level Security policies are simple: `USING (auth.uid() IS NOT NULL)` for SELECT (both users see everything), `WITH CHECK (auth.uid() IS NOT NULL)` for INSERT/UPDATE/DELETE. No per-user data isolation — both partners see and edit everything (Principle 4: two people, one truth).

- [ ] **AC13** The `user_name` field on `cernita_entries` (which records who evaluated an item) is populated from the authenticated user's `display_name`, not from a Settings text field. The Settings "Your name" field is removed.

### Frontend changes

- [ ] **AC14** The Settings tab removes all infrastructure fields: Supabase URL, Supabase anon key, Household ID, Cernita URL / Worker URL, Household password. Settings retains only user-facing preferences: storage rate, shipping rate, weight thresholds, Anthropic model selection.

- [ ] **AC15** The Supabase client is initialized once at app startup with the project URL and anon key baked into the build (environment variables at build time, not user-entered). These are public values (Supabase anon key is designed to be public; RLS is the security layer).

- [ ] **AC16** The login screen follows the established design system: Cormorant Garamond for the app name, Lato for form labels, terracotta accent on the sign-in button, the bilingual tagline beneath the logo. It should feel like the rest of Cernita, not like a generic auth form.

- [ ] **AC17** When the backend returns 401 (expired or invalid session), the frontend silently attempts a token refresh. If refresh fails, redirect to login with a message: "Session expired. Please sign in again."

### Backend changes

- [ ] **AC18** Vercel API routes (`api/anthropic.ts`, `api/bland.ts`, etc.) replace the `Authorization: Bearer <household_password>` check with Supabase Auth token verification. The backend calls `supabase.auth.getUser(token)` to validate.

- [ ] **AC19** The `HOUSEHOLD_PASSWORD` environment variable is removed from Vercel. Replaced by `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the service role key is server-side only, never exposed to the frontend).

- [ ] **AC20** The `/api/health` endpoint remains unauthenticated. It returns `{ "status": "ok" }` for uptime monitoring.

### Migration path

- [ ] **AC21** A migration guide documents the steps for moving from the old auth model to the new one. This is a one-time operation performed by the technical partner during the rebuild deployment.

- [ ] **AC22** Existing data (if migrated from the old database) has `household_id` columns dropped and `created_by` backfilled where possible (based on the `user_name` text field matching a known user's display name). Unmatched entries get `created_by = null` — acceptable for historical data.

## Data model changes

### Removed

```sql
-- Drop household_id from all tables (single-tenant, no longer needed)
ALTER TABLE cernita_entries DROP COLUMN IF EXISTS household_id;
ALTER TABLE cernita_boxes DROP COLUMN IF EXISTS household_id;
ALTER TABLE cernita_locations DROP COLUMN IF EXISTS household_id;
ALTER TABLE cernita_trips DROP COLUMN IF EXISTS household_id;
ALTER TABLE cernita_calls DROP COLUMN IF EXISTS household_id;
```

### Added

```sql
-- Add created_by to track which user created each record
ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE cernita_boxes
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE cernita_locations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE cernita_trips
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- RLS: both users see everything, both can edit everything
ALTER TABLE cernita_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON cernita_entries
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Repeat for all tables
```

### Not changed

- All feature columns (bilingual names, rationales, preservation flags, etc.) are untouched
- The `user_name` text column stays for display purposes but is auto-populated from auth, not user-entered

## UI states

### State A — Login screen (no session)

The full-screen login. App logo ("Cernita" in Cormorant Garamond), bilingual tagline below, email field, password field, sign-in button in terracotta. Clean, warm, intentional — not a framework default.

```
         ✦

      Cernita

  La cernita — the sorting.

  ┌─────────────────────────┐
  │ Email                   │
  └─────────────────────────┘
  ┌─────────────────────────┐
  │ Password                │
  └─────────────────────────┘

  ┌─────────────────────────┐
  │    Accedi · Sign in     │
  └─────────────────────────┘
```

### State B — Login error

Same screen, with a soft error banner below the button: "Email o password non validi · Invalid email or password." Red-terracotta text, no aggressive styling.

### State C — Loading (authenticating)

The sign-in button shows a subtle spinner. Fields are disabled. No redirect until auth completes.

### State D — Authenticated, normal app

The app loads normally. The user's display name appears in the Settings tab header and next to their evaluations in the Log. No infrastructure visible anywhere.

### State E — Session expired

A modal over the current view: "Sessione scaduta · Session expired. Please sign in again." One button: "Accedi · Sign in" → returns to login screen. No data loss — the user's work was saved to the database in real time.

### State F — Settings (authenticated)

Settings shows only user-facing preferences:

- Storage rate ($/month per cubic foot)
- Shipping rate (per-pound and per-cubic-foot)
- Weight thresholds (soft/hard limits for boxes)
- AI model selection
- Maintenance section (backfill buttons for bilingual translations, preservation data)
- Sign out button

No database URLs. No API keys. No household anything.

## Edge cases

- **EC1** Technical partner forgets to disable self-registration in Supabase. → A stranger could create an account and see all data. Mitigation: the deployment guide explicitly warns about this. The RLS policies allow any authenticated user — if registration is open, that's a real risk. Belt: add a check in the backend that verifies `auth.uid()` is one of the two known user IDs (from an environment variable `ALLOWED_USER_IDS`).

- **EC2** One partner changes their password via Supabase dashboard. → The other partner is unaffected (different account). The changed-password partner's existing sessions continue until they expire, then they log in with the new password.

- **EC3** Both partners are logged in simultaneously on two phones. → Normal and expected. Supabase Auth supports multiple concurrent sessions. Database writes are handled by Supabase's real-time sync as today.

- **EC4** Session token stored in localStorage gets cleared (browser data wipe). → User sees login screen on next open. They log in again. No data lost.

- **EC5** The technical partner needs to reset the non-technical partner's password. → Done via Supabase dashboard (Authentication → Users → find user → Reset password) or CLI. No in-app password reset flow needed.

- **EC6** Someone discovers the Supabase anon key (it's in the built JavaScript). → This is by design. The anon key allows only operations that pass RLS policies — and RLS requires authentication. An unauthenticated request with just the anon key gets nothing. This is Supabase's documented security model.

- **EC7** The frontend's Supabase URL is visible in the JavaScript bundle. → Acceptable. The URL is not a secret — it's a public endpoint. Security comes from RLS + authentication, not from URL obscurity.

- **EC8** The Vercel serverless functions need the Supabase service role key (bypasses RLS). → This key lives only in Vercel environment variables, never in frontend code. The backend uses it to verify auth tokens and to perform admin operations if needed. It is never returned to the client.

- **EC9** Migration from old database: entries with `user_name = 'Marco'` need to map to the new `created_by` UUID. → A one-time migration script matches `user_name` text against `auth.users.user_metadata.display_name` and sets `created_by` accordingly. Unmatched entries stay `null`.

- **EC10** Partner wants to use the app on a second device (tablet, laptop). → They log in on the new device with the same credentials. Multiple sessions per user are fine.

## Out of scope

- **Registration flow.** No self-service account creation. The technical partner creates accounts.
- **Password reset flow (in-app).** Handled via Supabase dashboard by the technical partner.
- **Email verification.** The two users' emails are known and trusted. No verification step.
- **Multi-household support.** One deployment = one household. Fork and deploy for a different household.
- **OAuth / social login (Google, Apple).** Complexity without value for two known users.
- **Magic links.** Email/password is simpler and more familiar for the non-technical partner.
- **Two-factor authentication.** The threat model (two people, personal inventory) doesn't warrant it.
- **User profile editing in-app.** Display name is set during account creation. If it needs changing, the technical partner updates it in Supabase.
- **Audit logging of login events.** Supabase Auth logs these by default in its dashboard. No in-app audit view needed.

## Open questions

- **Q1:** Should the Supabase anon key and URL be baked into the built JS at build time, or read from a non-secret environment variable at runtime?
  **A:** Build time. These are public, static values that don't change. Baking them in avoids an extra config step and a runtime fetch. Vercel's `NEXT_PUBLIC_` or equivalent prefix handles this.

- **Q2:** Should we add the `ALLOWED_USER_IDS` belt-and-suspenders check (EC1)?
  **A:** Yes. It's one line in the backend auth middleware and prevents an easy misconfiguration from being catastrophic. Store as a comma-separated env var.

- **Q3:** Should the login screen support "remember me" (persistent vs. session-only)?
  **A:** Always persistent. These are personal phones used daily. Requiring re-login every browser session would be friction without security value (the phone itself is the security boundary).

- **Q4:** What happens to the existing `user_name` text field on entries once we have `created_by`?
  **A:** Keep both during migration. New entries populate both (`created_by` from auth, `user_name` from display name). Eventually `user_name` becomes a display cache derived from `created_by`. Don't remove it in this spec — it's used in too many rendering paths.

- **Q5:** Should the login screen be bilingual?
  **A:** Yes. Labels in both languages, consistent with Principle 11. "Accedi · Sign in", "Email", "Password" (same in both languages), error messages bilingual.

All open questions resolved.

## References

- **Amendment 002** — Principle 3 revision (data sovereignty without user-managed infrastructure)
- **Constitution Principle 4** — Two people, one truth
- **Constitution Principle 7** — Architecture serves the user, not the developer
- **Constitution Principle 9** — Safety as default
- **Spec 003 (backend proxy)** — Superseded authentication model
- **Spec 004 (vercel deployment)** — Superseded Settings fields
- **Supabase Auth documentation** — supabase.com/docs/guides/auth
- **Rebuild honest notes** — Items 1-4 in the handoff README

## Implementation notes

1. **Supabase client initialization.** Use `@supabase/supabase-js` with the anon key baked in. Create the client once at app startup. Auth state changes trigger re-renders.

2. **Auth middleware for Vercel functions.** A shared `lib/auth.ts` that extracts the Bearer token, calls `supabase.auth.getUser(token)`, and returns the user or a 401. Replace the existing `verifyHouseholdAuth` function.

3. **Login component.** A standalone full-screen component rendered when `session === null`. Uses `supabase.auth.signInWithPassword({ email, password })`. On success, the session is set and the app renders.

4. **Session persistence.** Supabase JS client handles token storage and refresh automatically. Default behavior stores tokens in localStorage. The `onAuthStateChange` listener keeps the app in sync.

5. **RLS policies.** Keep them simple. `auth.uid() IS NOT NULL` for all operations. Both users see everything. This is intentional — Principle 4 says "two people, one truth." There's no data to hide between partners.

6. **User attribution.** When saving a new entry, populate `created_by` from `supabase.auth.getUser().id` and `user_name` from the user's `display_name` metadata. The backend can do this server-side for extra safety.

7. **Deployment checklist addition.** Add to the deployment guide:
   - Create Supabase project
   - Disable sign-ups in Auth settings
   - Create two users with display names
   - Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ALLOWED_USER_IDS` in Vercel env vars
   - Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the frontend build
