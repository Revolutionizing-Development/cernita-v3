# Cernita — Constitution

> *La cernita.* The sorting. What comes, what stays, what goes.

Version 1.6 · drafted April 27, 2026 · revised May 7, 2026

---

## Purpose

Cernita exists to help two people make ~500–1,000 small but consequential decisions about their physical belongings during an international move from Galesburg, Illinois → Colorado Springs, Colorado → a stone farmhouse near Todi, Umbria, Italy.

The decisions are **economic** (what costs less, all-in?), **practical** (will it survive 18 months in storage and an ocean container?), **logistical** (which bin, which trip, which suitcase?), and **emotional** (does this object carry meaning that math can't price?).

Cernita's job is to surface honest tradeoffs, do the math the user shouldn't have to do, and keep two people in sync across two phones over many months without anyone losing their place. It is not the decision-maker. The user is.

This document encodes the principles that should remain stable across every change to the codebase, every feature added, every spec written. Everything else is negotiable. These are not.

---

## Principle 1 — The user owns the decision

Cernita can suggest, calculate, surface tradeoffs, ask clarifying questions, and flag concerns. It must never silently override a user's choice, hide its reasoning, or present a recommendation as a verdict.

**In practice:**
- Every AI recommendation is a *suggestion* the user can override
- Every override is preserved through re-derivations, rule changes, and migrations
- The user's confirmed decisions are sacred — re-deriving must respect `user-confirmed sentimental` and similar manual flags
- The math behind every recommendation must be visible (not buried, not abbreviated)
- When the AI is uncertain, it asks rather than guesses

---

## Principle 2 — Honest math, always shown

Recommendations must be derived from real numbers, computed transparently. No rules of thumb dressed up as analysis. If the model uses estimates (resale value, replacement cost, condition assessment), it must show its work and label assumptions as such.

**In practice:**
- Every economic recommendation cites the actual numbers used to reach it
- Net-cost framing (replace − resale vs. storage + ship vs. carry-bag) is the comparison standard, not gross sums
- Estimates are labeled as estimates; verified measurements are visually distinct
- When numbers are uncertain, confidence is communicated (high / medium / low)
- Storage rate, shipping rate, and replacement assumptions are visible to the user and overridable

---

## Principle 3 — The data belongs to the user

Cernita is a tool, not a platform. The user's belongings list, photos, decisions, notes, and transcripts are theirs — portable, exportable, and deletable. The backend manages infrastructure on the user's behalf so neither partner needs to understand the plumbing.

**In practice:**
- The user can export everything as CSV at any time
- The user can request full data deletion and Cernita stops working — this is correct
- Database credentials, API keys, and service configuration live server-side, never in the frontend
- Authentication is a normal login screen, not a configuration step
- No user-facing field ever exposes a database URL, API key, or infrastructure detail
- If Cernita disappears, the data export remains useful on its own

---

## Principle 4 — Two people, one truth

Cernita is built for a couple. Every feature must work when both users are simultaneously evaluating items in different rooms, with intermittent connectivity, on different phones, with different mental models of what should be kept.

**In practice:**
- Single shared database is the source of truth (no per-device state that diverges)
- Every entry attributes to a user and is visible to both
- Disagreements are surfaced, not hidden — the Discuss tab is structural, not optional
- Sync state is always visible (online / syncing / offline)
- Conflict resolution favors transparency over silent merging

---

## Principle 5 — Decisions are versioned, not frozen

Rules will change. Storage rates will be corrected. Decision logic will improve. Items evaluated under old assumptions must remain useful, traceable, and re-derivable.

**In practice:**
- Every saved entry stores the rules version and rules snapshot it was evaluated under
- Pure observed facts (resale value, weight, replacement cost) are separated from derived decisions
- Decisions can be re-derived from facts using current rules, without re-calling the AI
- Re-derivations preserve user overrides
- The user can see when current rules would change a past decision, and choose whether to update

---

## Principle 6 — Intentional design over default design

Cernita's interface should feel made — by someone who cared, with attention to typography, spacing, color, and motion. The visual identity is a deliberate choice, not the accumulation of framework defaults and AI-suggested boilerplate. When the look needs to evolve, that's allowed; what isn't allowed is drifting into genericness through neglect.

**In practice:**
- New UI elements respect the established type ramp, color tokens, and motion system unless deliberately changing them
- "Default Bootstrap card with rounded corners and a subtle gradient" is a violation regardless of whether Bootstrap is actually used
- Decorative elements (icons, illustrations, ornaments) earn their place by serving the content, not by filling space
- Visual refreshes are allowed and don't require constitutional amendment — but they are deliberate redesigns, not drift
- The aesthetic should communicate the project's spirit: a couple's careful, almost romantic preparation for a new life

---

## Principle 7 — Architecture serves the user, not the developer

The technical implementation should be chosen to serve the user's experience, not the developer's preferences or the latest trend. Complexity is added when it pays for itself in user-facing value, not before. The stack may grow (build steps, frameworks, backends, native apps) when there's a real reason — but each addition is justified against what it costs the user in installability, transparency, or portability.

**In practice:**
- New dependencies, build steps, or services are added when they solve a real problem, not for novelty
- The user can always export their data and walk away — no lock-in
- Code remains readable to a non-specialist (no clever abstractions where simple ones work)
- If the architecture becomes more complex (proxy backend, framework, mobile apps), the simpler path it replaced is documented so we know why we moved
- Installability and zero-friction setup are valued highly but are not absolute — they trade off against features like proper API key management that justify their cost

---

## Principle 8 — Honest about limits

Cernita is built by AI, in conversation, in a single file. It is a real tool, but it is not a venture-backed product with a design team. Where it falls short of polished commercial software, that gap should be acknowledged rather than disguised.

**In practice:**
- "Why isn't this like [polished app]?" gets a real answer, not deflection
- Features that require infrastructure we don't have (backend proxy, native iOS, real-time collaboration) are scoped honestly or skipped
- Limitations that are inherent to the architecture (HTTPS required for camera, no offline AI) are documented prominently
- The roadmap distinguishes between "achievable in a single HTML file" and "would require a different architecture"

---

## Principle 9 — Safety isn't a feature, it's a default

Items that won't survive storage. Batteries that will corrode. Photos that will mold. Items that EU customs won't admit. These warnings exist because the cost of getting them wrong is the loss of irreplaceable things — not just money.

**In practice:**
- Safety/handling warnings are visually prominent, not buried in metadata
- Items flagged as "cannot survive storage" get routed away from the storage path automatically
- The AI proactively asks about sentimental value when visual signals suggest it might exist
- Customs restrictions are flagged at evaluation time, not discovered at the port
- When a recommendation involves real risk, the rationale says so explicitly

---

## Principle 10 — Specs over code

Behavior is defined in specifications. Code implements specifications. When they disagree, the spec is the source of truth, and either the code is wrong (fix it) or the spec is outdated (update it, then fix the code).

**In practice:**
- Every feature has a spec at `/specs/feature-name.md` before implementation begins
- Specs include user stories, acceptance criteria, data model changes, UI states, edge cases, and out-of-scope items
- Changes to behavior require spec updates — not just code commits
- The Constitution overrides any individual spec; specs cannot violate it
- AI-assisted code generation reads the relevant spec + Constitution before writing

## Principle 11 — Bilingual output, English and Italian, always

All user-facing output that could become a permanent record — item names, decision rationales, bin labels, manifests, exports, customs declarations — must be produced in both English and Italian. This is not a stylistic choice. It exists because the move's final destination is Italy, and Italian customs, insurance, port handlers, and Italian-speaking helpers will need to read what we produce.

**In practice:**
- AI evaluations include both an English item name and an Italian item name (e.g. *"Concept2 Model D rower / Vogatore Concept2 Model D"*)
- Decision categories appear in both languages (KEEP-ITALY · *Porta in Italia*) — already partially in place via the Caveat-italic accents
- Bin labels exported for physical printing show both languages
- CSV exports include English and Italian columns for item name, decision, rationale
- Future PDF exports (customs manifest, insurance list, moving company inventory) are produced bilingually with Italian as primary
- The UI itself remains primarily English (since that's the user's working language) but Italian phrases appear consistently for orientation and for items that will be read in Italy
- Translation accuracy matters: technical and legal terms must use correct Italian equivalents, not literal translations

## Principle 12 — Compliance with destination requirements

Outputs that will be submitted to authorities, insurance companies, or service providers at the destination must conform to those entities' actual format requirements. We do not invent our own formats for things that have official ones. We do not approximate where exactness matters. When a government, customs office, or required form has a defined structure, we produce that structure.

**In practice:**
- Customs declarations follow Italian government formats (Modello 4 and equivalents) — exact field names, exact terminology, Italian-primary
- Insurance manifests follow the insurer's required format, not our preferred layout
- Moving company inventory sheets conform to the carrier's format when one is specified
- Future destination paperwork (utility hookups, residency filings, banking documentation) follows the receiving party's required structure
- Where multiple acceptable formats exist, we choose the one most likely to be accepted without question
- Authoritative format references live in `/specs/standards/` and are kept up to date as Italian regulations change
- When in doubt about a format requirement, the spec must cite the source (government website, insurer documentation, carrier requirements)

---

## Principle 13 — Preservation is part of the math

Items deteriorate in storage and during transit. Wood warps. Leather molds. Vinyl warps. Foam crumbles. Electronics corrode. Paper fades.

Cernita treats preservation as a first-class consideration in evaluation:
- The AI flags meaningful deterioration risk in the rationale, not as a footnote
- The user is told what packing precautions a vulnerable item requires
- When survival probability is genuinely in doubt, confidence drops and alternatives gain weight in the comparison
- The user retains final authority. This principle is about honesty in the math, not paternalism in the recommendation.

The simple comparison "ship $90 vs replace $400" is incomplete when an item has a meaningful chance of arriving unusable. Cernita's commitment to honest math (Principle 2) requires that survival probability be one of the factors, not an unstated assumption.

---

## Principle 14 — Security is verified before every release, not assumed after one audit

The security and safety requirements defined in spec 017 are not a one-time checklist. They are a pre-release gate. Before any feature, build, or code change is packaged for deployment, the applicable security requirements must be verified — not retroactively, not "we'll audit later," not "it's the same pattern as last time."

This principle exists because AI-assisted development can produce correct-looking code at high velocity. Velocity without verification is a liability, not an asset. The verification step is what makes the velocity defensible.

**In practice:**
- Every build verifies: type safety (`tsc --noEmit`), production build (`next build`), and no regressions in the security posture
- New API routes must call `requireAuth()` as their first operation — no exceptions, no "we'll add auth later"
- New dependencies require documented justification against Principle 7 and a clean `npm audit`
- New pages must be wrapped in `AuthGuard` — unauthenticated access is a shipping blocker, not a follow-up ticket
- Server-side secrets (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) must never appear in client-side code — verified by searching the build output
- Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) are configured globally and verified after any `next.config.mjs` change
- AI output validation (unknown decisions → `NEEDS-HUMAN`, JSON parse in try/catch) is verified in code review for any change to the evaluation pipeline
- The OWASP Top 10 mapping in spec 017 §6 is reviewed when a new feature introduces a new attack surface (new API endpoint, new data type, new external integration)
- The risk acceptance register in spec 017 §9 is updated when a new risk is identified and consciously accepted

The goal is not zero risk — it is **no unexamined risk**. Every gap is either closed or documented with a rationale. "We didn't think about it" is the only unacceptable answer.

---

## What this Constitution is not

This document does not describe:
- **Specific features** — those live in `/specs/`
- **Implementation details** — those live in the code
- **The product roadmap** — that lives in `ROADMAP.md` (or similar)
- **Branding guidelines beyond aesthetic feel** — there is no formal brand
- **Licensing or distribution** — those are separate decisions

If a future change requires violating a principle here, the right move is to **propose an amendment** to the Constitution, not to work around it silently. Amendments require explicit acknowledgement that something foundational is changing — and the corresponding update to this document with a version bump.

---

## Amendment log

- **v1.6** (May 7, 2026) — Added Principle 14: security is verified before every release. Mandates that spec 017 security requirements are a pre-release gate, not a one-time audit. Every build must verify type safety, auth coverage, dependency security, secret isolation, and security headers. New attack surfaces trigger OWASP mapping review. Risk register must be maintained — "we didn't think about it" is the only unacceptable answer. Also updates move route from "Lubbock, Texas" to "Colorado Springs, Colorado" in Purpose section.
- **v1.5** (May 3, 2026) — Principle 3 rewritten from "data lives with the user" to "data belongs to the user". Separates data sovereignty (real value: portable, exportable, deletable) from user-managed infrastructure (implementation detail that harmed the non-technical partner). Backend now manages database connection and API keys server-side; authentication is a normal login screen. Implements amendment proposal 002.
- **v1.4** (April 28, 2026) — Added Principle 13: preservation is part of the math. Items deteriorate in storage and transit; honest decisions account for that survival probability. The AI flags risk in the rationale, surfaces required packing precautions, and lowers confidence when survival is in doubt. The user retains final authority. Implements amendment proposal 001.
- **v1.3** (April 27, 2026) — Added Principle 12: outputs submitted to authorities, insurers, or service providers at the destination must conform to those entities' actual format requirements. Captures Italian customs forms, insurance manifests, moving company inventories, and future destination paperwork. Authoritative format specs live in `/specs/standards/`.
- **v1.2** (April 27, 2026) — Principle 6 reframed from "Italian editorial aesthetic" (specific implementation) to "Intentional design over default design" (underlying value). Added Principle 11: bilingual output (English + Italian) required for all permanent records — driven by Italian customs, insurance, and port-handling needs at the final destination.
- **v1.1** (April 27, 2026) — Principle 7 replaced. The original "Single file, no build step" was an implementation choice masquerading as a principle. Replaced with "Architecture serves the user, not the developer" — a values-based framing that allows the stack to evolve while preserving what actually matters (portability, transparency, no lock-in, simplicity proportional to need).
- **v1.0** (April 27, 2026) — Initial draft, anchored to the state of Cernita after rule-versioning and responsive layout passes.
