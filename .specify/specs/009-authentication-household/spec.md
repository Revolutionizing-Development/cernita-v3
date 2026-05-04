# Authentication and household

> Two people, one app, normal login. The technical partner creates both accounts during deployment. No registration, no household ID fields, no infrastructure visible to either user. Supabase Auth handles sessions; the backend handles everything else.

| | |
|---|---|
| **Status** | draft |
| **Tier** | 4 (foundational — establishes the authentication model for the rebuild) |
| **Branch** | `feat/authentication` (to be created) |
| **Author** | Cernita team |
| **Drafted** | 2026-05-03 |
| **Last updated** | 2026-05-03 |
| **Constitution principles** | Principle 3 (data belongs to the user); Principle 4 (two people, one truth); Principle 7 (architecture serves the user) |
| **Supersedes** | Authentication model in specs 003 and 004 |
| **Depends on** | Amendment 002 (Principle 3 revision — accepted) |

---

## Problem

The previous Cernita required users to configure infrastructure through Settings fields: Supabase URL, Supabase anon key, Household ID, Household password, and Worker URL. Five fields that the non-technical partner should never see. This was the direct cause of the stalled deployment.

The rebuild replaces this with a normal login screen. Nothing else.

## User story

> As the non-technical partner, I open Cernita. I see email and password fields. I type the credentials my partner gave me. I'm in. I never see a database URL, an API key, or a household ID.
>
> As the technical partner, I create two user accounts in the Supabase dashboard during deployment. I set display names. I share the password. Done.

## Why hardcoded two users, not a registration flow

Cernita is for exactly two people doing one move. Adding registration means adding email verification, password reset, household creation, invitation logic, and orphaned-household edge cases — all serving zero users. The two people who will use this app are known in advance. Their accounts are created by the person who deploys the app. This is the simplest correct solution.

## Acceptance criteria

### Login flow

- [ ] **AC1** The app opens to a login screen when no active session exists. Two fields: email and password. One button: "Accedi · Sign in". No registration link, no forgot-password link.

- [ ] **AC2** On successful login, the app navigates to the Evaluate tab. The user's display name (from `user_metadata.display_name`) appears in Settings.

- [ ] **AC3** On failed login, the error reads: "Email o password non validi · Invalid email or password." No infrastructure details in the error message.

- [ ] **AC4** Sessions persist across app closes via Supabase JS's built-in token storage and refresh. The user does not re-login unless they explicitly sign out or the session becomes unrecoverable.

- [ ] **AC5** When the backend returns 401, the app redirects to login with: "Sessione scaduta · Session expired. Please sign in again."

- [ ] **AC6** A "Esci · Sign out" button in Settings ends the session and returns to the login screen.

### Account setup (deployment time, not in-app)

- [ ] **AC7** Both accounts are created via the Supabase dashboard (Authentication → Users → Add user) before the app is opened. Each user has: email, password, and `display_name` in `user_metadata`.

- [ ] **AC8** The Supabase project has self-registration disabled (Settings → Authentication → "Enable sign ups" = off). Only the two pre-created accounts can log in.

- [ ] **AC9** No `cernita_users` table, no `cernita_households` table. User identity comes entirely from Supabase Auth's `auth.users`.

### Database

- [ ] **AC10** No `household_id` column exists on any table. Data is implicitly single-household — one deployment, one household.

- [ ] **AC11** Row Level Security on all tables uses a single policy: `USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)`. Both users see and can edit everything (Principle 4: two people, one truth).

### Frontend

- [ ] **AC12** The Supabase client is initialized once at startup with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` baked in at build time. These are not user-configurable.

- [ ] **AC13** Settings removes all infrastructure fields (Supabase URL, anon key, Household ID, Worker URL, Household password). It retains only user-facing preferences: storage rate, shipping rate, weight thresholds, AI model selection.

- [ ] **AC14** The login screen uses the established design system: Cormorant Garamond for the app name, Lato for form labels, terracotta sign-in button, bilingual tagline. Not a framework default.

### Backend

- [ ] **AC15** Vercel API routes validate requests by calling `supabase.auth.getUser(token)` with the `Authorization: Bearer <token>` header. The backend's `SUPABASE_SERVICE_ROLE_KEY` is server-side only, never in frontend code.

## Data model

### RLS for all tables

```sql
-- Enable RLS and create a single authenticated-access policy on each table.
-- This pattern applies to cernita_entries, cernita_boxes, cernita_locations,
-- cernita_trips, cernita_calls.

ALTER TABLE cernita_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_access" ON cernita_entries
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
```

### No household_id

No `household_id` column on any table. This is a fresh Supabase project — no migration from a previous schema.

### Environment variables

| Variable | Location | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (frontend build) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel (frontend build) | Public anon key (safe to expose; RLS is the security layer) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server-side only) | Backend auth validation |

## UI states

### State A — Login screen (no session)

```
         ✦

      Cernita
  La cernita — the sorting.

  [ Email                   ]
  [ Password                ]

  [    Accedi · Sign in     ]
```

Cormorant Garamond for "Cernita". Lato for everything else. Terracotta button.

### State B — Login error

Same screen. Below the button: "Email o password non validi · Invalid email or password." in terracotta-soft text. No red boxes, no aggressive styling.

### State C — Authenticating

Sign-in button shows a subtle spinner. Fields are disabled. No redirect until auth completes.

### State D — Settings (authenticated)

Storage rate · Shipping rate · Weight thresholds · AI model · Maintenance section · [Esci · Sign out]

No database URLs. No API keys. No household fields.

### State E — Session expired

Modal over current view: "Sessione scaduta · Session expired. Please sign in again." One button: "Accedi · Sign in" → login screen. No data loss — work was saved in real time.

## Edge cases

- **EC1** Both partners logged in simultaneously → normal, expected, fully supported by Supabase Auth.
- **EC2** Session token cleared (browser data wipe) → user sees login screen, logs in again, no data lost.
- **EC3** Technical partner needs to reset the non-technical partner's password → via Supabase dashboard (Authentication → Users → Reset password). No in-app flow needed.
- **EC4** Supabase anon key visible in JS bundle → by design. RLS is the security layer. The anon key alone, without authentication, returns nothing.
- **EC5** Technical partner forgets to disable self-registration → a third party could create an account. Mitigation: the deployment guide explicitly warns about this step.

## Out of scope

- Registration flow — technical partner creates accounts
- In-app password reset — handled via Supabase dashboard
- Email verification — not needed for two known users
- OAuth / social login — complexity without value
- Two-factor authentication — threat model doesn't warrant it
- User profile editing in-app — display name set at account creation
- `created_by` tracking on entries — deferred; may be added in a future spec
- `ALLOWED_USER_IDS` backend allowlist — out of scope for the rebuild; addressed by disabling registration

## Implementation notes

1. **Supabase client.** Use `@supabase/supabase-js`. Create once in `lib/supabase.ts`. Auth state changes trigger React re-renders via `onAuthStateChange`.

2. **Auth middleware for API routes.** A shared `lib/auth.ts` extracts the Bearer token, calls `supabase.auth.getUser(token)`, and returns the user object or throws a 401.

3. **Login component.** Full-screen component rendered when `session === null`. Uses `supabase.auth.signInWithPassword({ email, password })`. On success, session is set and the app renders normally.

4. **Session persistence.** Supabase JS stores tokens in localStorage by default and handles refresh automatically. No custom refresh logic needed.

5. **Deployment checklist.**
   - Create fresh Supabase project
   - Disable sign-ups in Auth settings
   - Create two users with display names
   - Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel (frontend build)
   - Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel (server-side env vars)
   - Run schema migrations

## References

- Amendment 002 — accepted (Principle 3 revision)
- Constitution Principles 3, 4, 7
- Supabase Auth documentation — supabase.com/docs/guides/auth
- Spec 003 (backend proxy) — superseded auth model
- Spec 004 (Vercel deployment) — superseded Settings fields
