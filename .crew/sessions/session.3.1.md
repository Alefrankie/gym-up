# Session: 3.1

Story: Workout History Page (Phase 1, Round 3).
Parent spec: docs/architecture/contexts/workout-tracking/readme.md (the page is workout-tracking owned; the frontmatter `parent_spec: progress/readme.md` is a known discrepancy — see Phase 1 gap table).
Branch: `story-3.1`.

---

## Phase 0 — Rule Discovery (Angel + Alefrank shared)

### Rules loaded

- **golden-rules.md** (skill) — null policy, mutation policy, cross-context isolation, side-effect free reads, schema contracts, DDD, SOLID, naming, error handling, API design, QA-first.
- **qa-anti-patterns.md** (skill) — all 9 categories as context; relevant subset for story flagged below.
- **Project rules (no AGENTS.md / CLAUDE.md / .implement-rules.md at project root).**
- **crew-learnings.md (skill, quarantine)** — selectively loaded. Rules that match triggers for this story:
  - ✅ "Astro/Vite projects use `@/` prefix" (last-used 2026-07-27) — confirmed in tsconfig.json + vitest.config.ts: `@/*` → `./src/*`, `@db/*` → `./db/*`.
  - ✅ "now: Date for date-dependent use cases" (last-used 2026-07-29) — `getTodayWorkoutUseCase` and `StartWorkoutUseCase` already follow it; reuse for any date-dependent logic.
  - ✅ "tsc --noEmit after signature change" (last-used 2026-07-07) — applies to new repo methods.
  - ✅ "scoping blast radius of backend contract change" — new API route; grep call sites before declaring done.
  - ✅ "value crossing system boundary as enum/select" — `weightUnit` is the display enum; volume stored in kg, converted only at display.
  - ✅ "PowerShell here-strings corrupt UTF-8" — relevant for any terminal-side file writes.
  - ✅ "kebab-case for `src/layouts/` too" (project quarantine, last-used 2026-07-28) — new layouts must be kebab-case.
  - ✅ "inline `<script>` in Astro has its own scope" (project quarantine, last-used 2026-07-29) — applicable for the expand/collapse toggle if a `<script>` block is used.
  - ✅ "Astro form inputs use `value`, not `defaultValue`" (project quarantine, last-used 2026-07-29) — not applicable (no form inputs in this story).
- **No `*.pattern.md` or `*.flow.md` for workout-history** — story references `view-progress.flow.md` but that file describes progress charts (story 3.2/3.3), not history. Pattern inferred from existing dashboard.astro + workout-summary.astro + complete-workout.use-case.ts.

### Story 3.1 summary (from `docs/stories/phase-1/round-3/story-3.1.md`)

- AC-3.1-01: History shows all workouts per FR-PR-001 (chronological, date DESC; each: date, routine day, exercises, volume; tap to expand for set detail).
- AC-3.1-02: Paginated at 20/page.
- Tasks: T3.1-01 (page), T3.1-02 (fetch), T3.1-03 (pagination), T3.1-04 (expandable detail).
- Blocked by story-2.6 — the blocker code (`CompleteWorkoutUseCase`, `workout-summary.astro`) is already implemented; story-2.6.md itself is still `status: draft` but the gates pass.

### Architecture context (verified)

- **Workout-tracking** owns `workouts` and `workout_entries` (the data this story reads).
- **Progress** is a separate planned context for charts/calendar/streak (stories 3.2, 3.3) — does NOT own the history page.
- Existing `WorkoutRepository` abstract (workout-tracking/domain/workout.repository.ts) has: `findById`, `findByUserAndDate`, `findInProgressByUser`, `create`, `update`, `delete`, `addEntry`, `findEntries`, `updateEntry`. **No `getHistoryByUser` yet.**
- `WorkoutRepository.getHistoryByUser(userId, limit, offset): Promise<Workout[]>` is described in the readme's "Use Cases" table as `GetWorkoutHistoryUseCase` (status: planned).
- `getWorkoutDetailUseCase` also planned in the readme (single workout + all entries).
- `RoutineRepository` (workout-tracking) has `findAll`, `findById`, `findDayByTypeAndDayNumber`, `findDayWithExercises` — the readme is out of date vs. code; **code wins**.
- **No `ExerciseRepository` port or class exists.** The readme lists it as planned, but only `RoutineRepository` covers exercise slots (routine_exercises), not the bare `exercises` table.
- `SqliteWorkoutRepository` exists and is fully implemented for current methods.
- `workout-tracking.composition.ts` is the per-context composition root (ADR-010) — wires repos + use cases. Exports `profileRepository`, `routineRepository`, `workoutRepository`, `photoRepository` and 4 use cases today.
- Auth context: `getAuthService()` + `getSessionIdFromRequest(Astro.request)`.
- Path aliases confirmed: `@/*` → `src/*`, `@db/*` → `db/*`. **No `@lib/` prefix.**
- Test infra: `tests/workout-tracking/test-db.ts` provides `createTestDb()` returning an in-memory SQLite with all 8 tables. Pattern: real `SqliteXxxRepository`, no mocks (ADR-009).

### QA anti-patterns relevant to this story (Phase 3 self-QA checklist)

| Category | Relevance | Specific check |
|----------|-----------|----------------|
| 1 (Silent Value Reversion) | N/A | Read-only page. |
| 2 (Calculation Logic) | **HIGH** | Volume = sum of (reps × weight) for completed entries. Test with: 0/1/many sets, mixed completed, mixed reps, mixed weights. |
| 3 (State Persistence) | MEDIUM | Pagination state is in the query string (no React state). Verify `?page=N` survives page reload. |
| 4 (UI Affordances) | **HIGH** | Status badge, expand toggle, pagination prev/next, empty state ("Aún no tienes workouts"), error state (failed detail fetch), 401/404 on the API route. |
| 5 (Cascade) | N/A | No delete. |
| 6 (Error Paths) | **HIGH** | API route: 401 (no session), 404 (workout not found), 403 (cross-user). Page: redirect to login if no session; empty-state UI if zero workouts; failed detail fetch surface to user. |
| 7 (Migration) | N/A | No schema change. |
| 8 (Cross-Feature) | LOW | History read-only against workout-tracking; no cross-context mutation. Cross-user guard: page is for current user only; findById is read-all per ADR-004 but the use case enforces `workout.userId === userId` for detail. |
| 9 (Type-Safety) | **HIGH** | New repo signatures (`getHistoryByUser`, `getHistoryCountByUser`, `getEntriesWithExercises`). Run `tsc --noEmit` after wiring. |

### Pre-flight (filled by Angel)

- [x] Session log created.
- [x] Rules loaded.
- [x] QA anti-patterns: relevant categories flagged (2, 3, 4, 6, 9).
- [ ] Angel: Problem Briefing + gap table — next phase.
- [ ] Angel ↔ Alefrank alignment.
- [ ] Alefrank: implementation plan.
- [ ] User approval.
- [ ] Julian: TDD.
- [ ] Fely: QA.

---
