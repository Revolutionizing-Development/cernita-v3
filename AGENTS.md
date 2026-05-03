# AGENTS.md — Cernita

## Spec-Driven Development

This project follows Spec-Driven Development using [Spec Kit](https://github.com/github/spec-kit).

### Rules

1. **Read the Constitution first.** `.specify/memory/constitution.md` contains 13 non-negotiable principles. Every implementation decision must be tested against them.

2. **Specs are the source of truth.** When code and spec disagree, the spec wins. Update the spec first if behavior needs to change.

3. **Bilingual always.** All permanent records (item names, rationales, labels, exports) must be in both English and Italian (Constitution Principle 11).

4. **Two-phone reality.** Every feature must work with two users on two phones simultaneously (Constitution Principle 4).

5. **Intentional design.** No framework defaults. Respect the established type ramp (Cormorant Garamond), color tokens (terracotta, olive, ink), and motion system. "Default Bootstrap card" is a violation (Constitution Principle 6).

6. **Architecture serves the user.** Complexity is added when it pays for itself in user-facing value, not before (Constitution Principle 7).

### Workflow

```
/speckit.constitution  →  Review/update principles
/speckit.specify       →  Define what to build
/speckit.clarify       →  Resolve ambiguities
/speckit.plan          →  Technical implementation plan
/speckit.tasks         →  Task breakdown
/speckit.implement     →  Build it
```

### File locations

- Constitution: `.specify/memory/constitution.md`
- Specs: `.specify/specs/NNN-feature-name/spec.md`
- Plans: `.specify/specs/NNN-feature-name/plan.md`
- Tasks: `.specify/specs/NNN-feature-name/tasks.md`
- Templates: `.specify/templates/`
- Amendments: `amendments/`
- Design research: `docs/`
