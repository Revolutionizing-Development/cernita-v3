# Cernita

> *La cernita.* The sorting. What comes, what stays, what goes.

An AI-powered moving inventory and decision support tool for an international move from Galesburg, Illinois → Lubbock, Texas → a stone farmhouse near Todi, Umbria, Italy.

Cernita helps two people make ~500–1,000 small but consequential decisions about their physical belongings. It surfaces honest tradeoffs, does the math, and keeps two people in sync across two phones over many months.

## Project status

This is a **rebuild from thinking artifacts**. The previous codebase (~6,250 lines single-file HTML + Vercel API functions) is being replaced with a proper architecture. The methodology, constitution, and feature specs are preserved — the architecture is what's changing.

### What's preserved

- **Constitution** (13 principles, v1.4) — the non-negotiables
- **8 feature specs** — 4 shipped in the previous codebase, 4 in draft
- **1 accepted amendment** — Principle 13 (preservation is part of the math)
- **UI study** — design research against category leaders (Sortly, MoveAdvisor)

### What's being rebuilt

- Authentication (real login, not settings-field passwords)
- Database connection (server-side, not user-configured Supabase URLs)
- Architecture (proper app structure, not single-file HTML)
- The "Worker URL" / "Cernita URL" pattern (app calls its own backend)

## Stack

- **Frontend:** TBD (rebuild decision)
- **Backend:** Vercel serverless functions
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude (via backend proxy)
- **Phone calls:** Bland.ai (optional)

## Spec-Driven Development

This project uses [Spec Kit](https://github.com/github/spec-kit) for structured development. All behavior is defined in specifications before implementation.

### Slash commands

| Command | Purpose |
|---|---|
| `/speckit.constitution` | Review or update the 13 governing principles |
| `/speckit.specify` | Define what to build next (requirements + user stories) |
| `/speckit.plan` | Create technical implementation plan |
| `/speckit.tasks` | Generate actionable task breakdown |
| `/speckit.implement` | Execute tasks according to the plan |
| `/speckit.clarify` | Clarify underspecified areas before planning |
| `/speckit.analyze` | Cross-artifact consistency check |

### Spec status

| # | Feature | Status | Tier | Dependencies |
|---|---|---|---|---|
| 001 | Bilingual item names | shipped | 2 | — |
| 002 | Bilingual rationale | shipped | 2 | 001 |
| 003 | Backend proxy | shipped (auth model) | 3 | — |
| 004 | Vercel deployment | shipped | 3 | — |
| 005 | Log search | draft | 2 | 001, 002 |
| 006 | Location tracking | draft | 3 | 001, 002 |
| 007 | Trips & suitcases | draft | 3 | 006 |
| 008 | Preservation-aware packing | draft | 3 | 006, amendment 001 |

### Reading order

1. `.specify/memory/constitution.md` — 13 principles. The non-negotiables.
2. `docs/UI-STUDY.md` — design research and competitive analysis.
3. `.specify/specs/NNN-feature/spec.md` — individual feature specs.
4. `amendments/` — constitution amendments.

## Honest notes for the rebuild

1. **The in-UI Supabase config was a mistake.** Database connection is a server concern.
2. **Authentication should be normal.** Login screen, session, standard patterns.
3. **The household concept stays.** Two-people-one-household is the right shape, but identified via authenticated identity, not a typed string.
4. **No "Cernita URL" field.** A modern app calls its own backend.
5. **The methodology and specs are still valuable.** It's the architecture that needs rebuilding, not the thinking.
6. **Vercel + Supabase is still fine.** The platform matches what works. The shape of the app is the issue.

Constitution Principle 7 — "Architecture serves the user, not the developer" — is the lens for every rebuild decision.

## License

Private project.
