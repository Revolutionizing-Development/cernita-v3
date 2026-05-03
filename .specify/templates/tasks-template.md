# Tasks: [Feature title]

> Task breakdown for `.specify/specs/NNN-feature/spec.md`

| | |
|---|---|
| **Spec** | [link to spec] |
| **Plan** | [link to plan] |
| **Total tasks** | [count] |
| **Created** | [date] |

---

## Legend

- `[ ]` — not started
- `[~]` — in progress
- `[X]` — completed
- `[P]` — can run in parallel with adjacent tasks
- `(depends on TNNN)` — blocked until dependency completes

## Phase 1 — [Foundation]

- [ ] **T001** [Task description] `[file paths]`
- [ ] **T002** [Task description] `[file paths]` (depends on T001)
- [ ] **T003** [P] [Parallelizable task] `[file paths]`

### Checkpoint: [What should work at this point]

## Phase 2 — [Core feature]

- [ ] **T004** [Task description] `[file paths]` (depends on T001)
- [ ] **T005** [Task description] `[file paths]`

### Checkpoint: [What should work at this point]

## Phase 3 — [Polish and edge cases]

- [ ] **T006** [Task description] `[file paths]`
- [ ] **T007** [Task description] `[file paths]`

### Checkpoint: [Feature complete — run full manual test checklist]

## Manual test checklist

- [ ] Fresh install works
- [ ] Existing user migration works
- [ ] Two phones see same data (Supabase sync)
- [ ] Old cached version degrades gracefully
- [ ] Mobile keyboard behavior correct
- [ ] [Feature-specific checks from spec]
