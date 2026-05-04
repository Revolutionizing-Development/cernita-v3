# Amendment proposal 002: Data sovereignty without user-managed infrastructure

| | |
|---|---|
| **Status** | accepted |
| **Proposed** | 2026-05-03 |
| **Author** | Cernita team |
| **Type** | Modification (Principle 3 rewritten, no principle removed or added) |
| **Constitution version after** | 1.5 (currently 1.4) |

---

## What changes

Rewrite Principle 3 from:

> **Principle 3 — The data lives with the user**
>
> Cernita is a tool, not a service. The user's belongings list, photos, decisions, notes, and call transcripts live in **the user's own Supabase project**. Anthropic, Bland, and any other API the app uses are accessed with **the user's own API keys**.
>
> **In practice:**
> - No data is sent to a Cernita-owned backend (there isn't one)
> - The user can export everything as CSV at any time
> - The user can delete their database and Cernita stops working — this is correct
> - Future hosted variants must preserve user data ownership as a primary value
> - API keys remain under user control; if backend proxying is added, it is opt-in

To:

> **Principle 3 — The data belongs to the user**
>
> Cernita is a tool, not a platform. The user's belongings list, photos, decisions, notes, and transcripts are theirs — portable, exportable, and deletable. The backend manages infrastructure (database, API keys, authentication) on the user's behalf, so neither partner needs to understand or configure the plumbing. The technical partner manages the infrastructure once; both partners use the app normally.
>
> **In practice:**
> - The user can export everything as CSV (and eventually PDF) at any time
> - The user can request full data deletion and Cernita stops working — this is correct
> - Database credentials, API keys, and service configuration live in server-side environment variables, never in the frontend
> - Authentication is a normal login screen, not a configuration step
> - No user-facing field ever exposes a database URL, API key, or infrastructure detail
> - The backend is a thin layer that serves the user — it holds no business logic that couldn't be reconstructed from the data export
> - If Cernita the app disappears, the data remains useful on its own (CSV of items, decisions, rationales, photos)

## Why it matters

Three reasons this deserves a constitutional revision rather than just a spec-level workaround:

**1. The original principle conflated two values.** "Data lives with the user" encoded both data sovereignty (the user owns their data, can export it, can leave) and user-managed infrastructure (the user runs their own Supabase, types their own API keys). The first is a real value that protects the user. The second is an implementation detail that actively harms the non-technical user — it was the root cause of the failed deployment and the authentication UX problems.

**2. The "in practice" bullets are now false.** "No data is sent to a Cernita-owned backend (there isn't one)" — there is one, and there should be. "API keys remain under user control" — they shouldn't; that's what the backend proxy spec was built to fix. A Constitution principle whose "in practice" section describes a state we've already intentionally abandoned is misleading.

**3. This is the same pattern as Principle 7.** Principle 7 was rewritten from "Single file, no build step" (implementation) to "Architecture serves the user, not the developer" (value) in v1.1. The reasoning was identical: an implementation choice was masquerading as a principle. Principle 3 has the same problem — "user's own Supabase project" is an implementation choice, "data belongs to the user" is the actual value.

## What becomes possible

With the revised Principle 3:

- **Normal authentication.** Login screen with email/password. No Settings fields for database URLs or household passwords.
- **Server-side database connection.** The backend connects to Supabase; the frontend authenticates to the backend. Users never see infrastructure.
- **A hardcoded two-user setup.** The technical partner creates both accounts once during deployment. No registration flow, no self-service onboarding. Two people, one app — matching the physical reality of the move.
- **Simpler onboarding for the non-technical partner.** Open the app, type your name and password, start evaluating. No paste-this-URL, no find-this-key, no run-this-migration.

## What becomes impossible (or harder)

With the revised Principle 3, certain things the original enabled become harder:

- **"Bring your own Supabase" as a default.** A new user can no longer spin up their own Supabase project and point Cernita at it out of the box. The backend now owns the database connection. This was the original vision and it's being deliberately abandoned — it optimized for developer autonomy at the cost of usability for the actual user.
- **Running Cernita without any backend.** The original single-HTML-file-talks-directly-to-Supabase model is no longer possible. This was already true after the backend proxy shipped — this amendment makes it official.
- **Zero infrastructure deployment.** Someone now has to deploy and maintain the Vercel project. This cost was already being paid; the amendment acknowledges it rather than pretending it doesn't exist.

These limits are intentional. They trade developer flexibility for user experience — which is what Principle 7 says to do.

## What does NOT change

- **Data export.** CSV export stays. PDF export is planned. The user can always get their data out.
- **Data deletion.** The user can request deletion and the app stops working. Still correct.
- **No vendor lock-in.** The data format (PostgreSQL tables with clear schemas) is portable. Nothing about Cernita's data model requires Supabase specifically — it's standard SQL.
- **Principle 4 (two people, one truth).** Unchanged and reinforced — the shared database is still the single source of truth.
- **Principle 7 (architecture serves the user).** This amendment is an application of Principle 7's values to Principle 3's implementation.

## Migration impact

The amendment itself changes no code. It changes the standard against which the authentication and deployment architecture is judged.

It retroactively validates the backend proxy spec (003) and vercel-deployment spec (004), which already moved API keys server-side. It also retroactively validates the "honest notes for the rebuild" that identified the in-UI Supabase config as a mistake.

The new architecture spec (009, forthcoming) is the implementation of this amendment.

## Discussion notes

**Why not just add a Principle 14 about authentication?**

Authentication isn't a new value — it's a consequence of getting Principle 3 right. The problem isn't that we're missing a principle about login screens; it's that the existing Principle 3 mandates an architecture (user-managed Supabase) that produces bad authentication UX. Fix the principle, and the authentication spec flows naturally from it.

**Is "data belongs to the user" meaningfully different from "data lives with the user"?**

Yes. "Lives with" implied physical co-location — the data sits in the user's own infrastructure. "Belongs to" is about ownership rights — the user can access, export, and delete their data regardless of where it's hosted. The second is the actual value; the first was an implementation of it that turned out to be wrong for the actual users.

**Could this open the door to a SaaS model?**

Technically yes, but Constitution Principle 8 ("honest about limits") and the project's nature (a personal tool for two people doing one move) make that a non-concern. This amendment doesn't add multi-tenancy, billing, or user acquisition. It adds "the backend manages the database connection instead of the user."

## Suggested principle wording (final)

> **Principle 3 — The data belongs to the user**
>
> Cernita is a tool, not a platform. The user's belongings list, photos, decisions, notes, and transcripts are theirs — portable, exportable, and deletable. The backend manages infrastructure on the user's behalf so neither partner needs to understand the plumbing.
>
> **In practice:**
> - The user can export everything as CSV at any time
> - The user can request full data deletion and Cernita stops working — this is correct
> - Database credentials, API keys, and service configuration live server-side, never in the frontend
> - Authentication is a normal login screen, not a configuration step
> - No user-facing field ever exposes a database URL, API key, or infrastructure detail
> - If Cernita disappears, the data export remains useful on its own

## Decision required

Per PROCESS.md, Constitution amendments need explicit acceptance. To accept this amendment:

1. Acknowledge in conversation that the amendment is accepted
2. The Constitution is updated to v1.5 with Principle 3 rewritten
3. The amendment proposal status moves to "accepted"
4. The architecture-rebuild spec (009) can then proceed with constitutional grounding
