---
story_id: "8.3"
round: "round-8"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/routines/readme.md"
size: "M"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["routines"]
  prd_requirements: ["FR-RT-010", "FR-RT-011", "FR-RT-012", "FR-RT-013", "FR-RT-014"]
  architecture_decisions: ["ADR-019"]
  flows: ["next-workout.flow.md"]
blocked_by: ["story-8.1"]
blocks: ["story-9.1"]
---

# Story 8.3 — Next-workout rotation & dashboard

Parent: [../readme.md](../readme.md)

## Summary

Replaces the weekday model of the dashboard with the rotation of [ADR-019](../../../architecture/decisions/019-rotation-scheduling-and-onboarding.md) §1: the dashboard always answers "Siguiente: {routine}" for the active program, lists the other routines with "hecha hace N días", and never shows a rest-day screen. `GetNextWorkoutUseCase` replaces `GetTodayWorkoutUseCase`, the rest-day picker disappears, and workouts started from a routine now carry their `program_id` so the rotation advances after each finish. *Empezar* still opens the Phase 1 workout page until story 9.1. Closes G2 ("next workout always ready") and the dashboard part of FR-RT-011..014.

## Files in scope

**Modify**

- `src/pages/dashboard.astro` — removes the `?day` parsing, the weekend rest-day picker, its styles and the `getTodayWorkoutUseCase` call; renders the states of [Happy Path](#happy-path). The cardio banner and the nutrition card stay.
- `src/lib/contexts/workout-tracking/application/start-workout.use-case.ts` — sets `programId` from the routine day's parent program and keeps `name = routineDay.dayName` (story 7.1); idempotency becomes "resume the user's in-progress workout" (see [Decisions](#decisions)).
- `src/lib/contexts/workout-tracking/workout-tracking.composition.ts` — removes the `getTodayWorkoutUseCase` export.
- `src/lib/contexts/workout-tracking/domain/routine.repository.ts` and both implementations (`sqlite-routine.repository.ts`, `supabase-routine.repository.ts`) — remove `findDayByTypeAndDayNumber`, which only `GetTodayWorkoutUseCase` used.
- `src/lib/contexts/workout-tracking/domain/workout-tracking.constants.ts` — removes `Weekdays` and `Weekday` (no reader left); `RoutineTypes` stays (profile and nutrition use it).
- `src/lib/contexts/routines/domain/profile-program-settings.ts` and its two implementations — only if story 8.1's `find` does not yet return the full `ProgramSettings` (`defaultRestSeconds`, `timezone`).
- `src/lib/contexts/routines/routines.composition.ts` — exports `getNextWorkoutUseCase`.
- `src/pages/settings.astro` — the "Tipo de rutina" help text becomes "Solo orienta la recomendación de calorías. Cambia tu programa desde Entrenar." The field stays, because the nutrition goal hint still reads `routine_type`.
- `tests/workout-tracking/start-workout.use-case.test.ts` — updated for the new idempotency and `programId`.

**Delete**

- `src/lib/contexts/workout-tracking/application/get-today-workout.use-case.ts` and `tests/workout-tracking/get-today-workout.use-case.test.ts`.

**Create**

- Domain, `src/lib/contexts/routines/domain/`: `rotation.ts` (`computeNextRoutine`, `daysSince`), `duration-estimate.ts` (`estimateRoutineMinutes`), `rotation.query.ts` (`RotationQuery`).
- `src/lib/contexts/routines/application/get-next-workout.use-case.ts`, `next-workout-presenter.ts` (pure formatting: target text, "hecha hace N días", estimate label).
- `src/lib/contexts/routines/infrastructure/sqlite/sqlite-rotation.query.ts`, `.../supabase/supabase-rotation.query.ts`.
- `src/pages/api/routines/next.ts` (GET).
- `src/components/next-workout-card.astro`, `src/components/routine-picker-list.astro`.
- Tests listed in the [Test Plan](#test-plan).

**Not in scope** (must not change): `workout/[id].astro`, the workout API endpoints, `complete-workout.use-case.ts`, progress and family pages.

## Happy Path

1. The user opens `/dashboard` (FR-RT-010). The page resolves the session and calls `getNextWorkoutUseCase.execute({ userId })`.
2. With an active program: the use case reads the program's non-archived routines ordered by `dayNumber`, finds the last completed workout with `program_id = activeProgramId` and `completed_at > rotationAnchorAt`, and picks the routine after it (first one when there is none or when it was the last).
3. The card "Siguiente: {routine name}" shows the program name, each exercise as "{name} · {sets} × {min}–{max}" (seconds for duration types, sets only for distance types), "≈ {N} min" and a full-width *Empezar* (FR-RT-011).
4. Below it, *Elegir otra rutina* lists every other non-archived routine in rotation order with "hoy", "ayer", "hace N días" or "Nunca", each with its own *Empezar* (FR-RT-012). There is no rest-day screen.
5. *Empezar* posts `routine_day_id` to `POST /api/workouts`; the new workout stores `program_id` and `name`, and the user lands on the Phase 1 `/workout/[id]` page.
6. The user finishes the workout. On the next dashboard load the card shows the following routine (wrapping after the last). Training a routine out of order moves the rotation to the one after it (Gravl behaviour).
7. With an in-progress workout the dashboard shows "Continuar entrenamiento" with the workout's name instead of the next-workout card.
8. Without an active program the page shows "Elige tu programa" (FR-RT-014); with a program that has no active routines it shows the empty-program card.
9. Activating another program or reordering routines (story 8.2) moves the anchor, so the card shows the first routine of the new order (FR-RT-013).

## Decisions

- **`program_id` is set by the Phase 1 start path.** The context says the dashboard "still posts `routine_day_id`", but the rotation reads `workouts.program_id`, so `StartWorkoutUseCase` must set it. It looks up the routine day through `RoutineRepository.findDayWithExercises` and stores `routineDay.routineId` (the program id) as `programId`. Story 9.1 replaces this with `RoutinePlanPort`.
- **Idempotency of start changes.** Phase 1 returned the user's workout of the same day. That would block the rotation after the first finish of the day, and [ADR-016 §2](../../../architecture/decisions/016-workout-data-model-v2.md) allows several workouts per day. New rule: a start resumes the user's `in_progress` workout (found with `findInProgressByUser`), otherwise creates a new one. A unique-index violation on `uq_workouts_one_in_progress` re-reads and resumes. (Hevy behaviour: one active workout, many per day.)
- **In-progress workout hides the next card.** With an unfinished workout *Empezar* would silently resume it, so the dashboard shows only *Continuar entrenamiento* (hidden fields `routine_day_id` and `workout_id`, the Phase 1 form). Story 9.1 adds the continue-or-discard choice (FR-WT-019).
- **Hidden until later stories** ([phase rule 7](../readme.md#7-forward-compatible-ui)): *Entrenamiento libre* (9.1), the readiness and recovery hints and the fatigue marker (10.4). The `muscleGroups` field of `RoutineCard` is returned for them.
- **Links to later pages.** The "Elige tu programa" card links to `/onboarding` and `/train/templates` (story 8.4) and to `/train` (story 8.2). Round 8 ships as one release, so the 8.4 targets exist when the card is visible; before then they answer 404.
- **Rotation arithmetic** works on `dayNumber` of the last workout's routine **inside this program, archived included**, then looks forward among non-archived routines (flow edge case "Last routine archived"). A last workout whose routine is no longer in the program is treated as no history.
- **Anchor field.** The rotation reads `routines.rotation_anchor_at`. The next-workout flow doc still says `routines.updated_at`; the docs task fixes it.
- **Estimate rule** (FR-RT-011 plus the context decision): `Σ (targetSets + warmupSets) × (40 + (restSeconds ?? defaultRestSeconds))` seconds, divided by 60, plus 5, rounded to the nearest 5, minimum 5. `restSeconds = 0` means no rest, it is not "default".
- **`daysSince`** compares calendar dates in `profiles.timezone` (default `UTC` from story 7.1), not elapsed hours.
- **`GET /api/routines/next`** returns the `NextWorkoutView` as JSON with `Cache-Control: private, no-cache`; the service-worker caching arrives with story 12.3.
- **Astro components stay thin.** Text formatting lives in `next-workout-presenter.ts` so it is unit-testable without rendering Astro.

## Acceptance Criteria

- AC-8.3-01: `computeNextRoutine` over non-archived routines ordered by `dayNumber` returns the first routine with `dayNumber > lastDayNumber`, wraps to the first after the last, returns the first when `lastDayNumber` is undefined, and never returns an archived routine (FR-RT-010).
- AC-8.3-02: `daysSince(lastDoneAt, now, timezone)` returns calendar-day differences in the timezone (0 = "hoy", 1 = "ayer") and handles the day boundary and daylight saving changes.
- AC-8.3-03: `estimateRoutineMinutes` follows the rule above: default rest versus explicit rest, `0` rest, warm-up sets counted, rounding to 5 minutes, minimum 5 (FR-RT-011).
- AC-8.3-04: `GetNextWorkoutUseCase` returns `{ kind: 'no_program' }` when the profile has no active program or the program no longer exists, and `{ kind: 'empty_program', program }` when it has no non-archived routine (FR-RT-014).
- AC-8.3-05: Given workouts of the user, the next routine ignores free workouts (`program_id` null), workouts of other programs, in-progress workouts and workouts completed at or before `rotationAnchorAt`; a completed workout of routine K makes K + 1 next; completing routine 3 of 3 makes routine 1 next (AC-R8-03).
- AC-8.3-06: A migrated Phase 1 user (history with `program_id = NULL` on template days) gets the first routine of the adopted program as next and "Nunca" for every routine's last-done label (flow edge case "Migrated Phase 1 user").
- AC-8.3-07: Each `RoutineCard` has the exercise list (`name`, `exerciseType`, `targetSets`, range), `estimatedMinutes`, distinct primary `muscleGroups`, `lastDoneAt` (real last date, no anchor) and `daysSinceLastDone`; `others` lists every other non-archived routine in rotation order (FR-RT-011, FR-RT-012).
- AC-8.3-08: Activating a program or reordering routines (use cases from stories 8.1 and 8.2) restarts the rotation at the first routine, and switching back to a previous program also starts at its first routine; past workouts are unchanged (FR-RT-013, OQ-003).
- AC-8.3-09: `StartWorkoutUseCase` stores `programId` and `name` for a new workout, resumes an existing in-progress workout of the user instead of creating a second one, and creates a new workout when only completed workouts exist for today; end to end, start → log a set → complete → `GetNextWorkoutUseCase` shows the following routine.
- AC-8.3-10: `/dashboard` renders: the next card ("Siguiente: {name}", program, exercise lines, "≈ N min", *Empezar*), the *Elegir otra rutina* list with its labels, the in-progress card, the "Elige tu programa" card (*Responder el cuestionario*, *Ver plantillas*, *Mis programas*) and the empty-program card (*Añadir rutina*); there is no `?day` handling and no rest-day picker on any weekday.
- AC-8.3-11: `next-workout-presenter` formats targets as "Press · 3 × 8–12", "Plank · 3 × 30–60 s", "Running · 3 series" (distance types show sets only) and the last-done labels "hoy", "ayer", "hace 3 días", "Nunca".
- AC-8.3-12: `GET /api/routines/next` returns 200 with the view, 401 without a session, and the `Cache-Control: private, no-cache` header.
- AC-8.3-13: `GetTodayWorkoutUseCase`, its composition export, `findDayByTypeAndDayNumber` and `Weekdays` no longer exist; `grep` over `src/` and `tests/` finds none, `npm run typecheck` and every Phase 1 suite pass, and the Phase 1 regression test still returns the recorded numbers.
- AC-8.3-14: `RotationQuery` returns the same results on both backends and never mixes users, although Supabase reads are read-all (`user_id` filter tested with a second user).

## Tasks

- [ ] `T8.3-01` - `rotation.ts` (`computeNextRoutine`, `daysSince`) with table-driven tests.
- [ ] `T8.3-02` - `duration-estimate.ts` with table-driven tests.
- [ ] `T8.3-03` - `RotationQuery` port, `SqliteRotationQuery`, `SupabaseRotationQuery`; repository tests.
- [ ] `T8.3-04` - `GetNextWorkoutUseCase` and `routines.composition.ts` export; use-case tests with an injected `now`.
- [ ] `T8.3-05` - `next-workout-presenter.ts` and tests.
- [ ] `T8.3-06` - `StartWorkoutUseCase`: `programId`, new idempotency, updated tests; end-to-end rotation test.
- [ ] `T8.3-07` - `GET /api/routines/next` and handler test.
- [ ] `T8.3-08` - `next-workout-card.astro`, `routine-picker-list.astro`; rewrite `dashboard.astro` (states, in-progress card, no rest-day code, styles cleanup).
- [ ] `T8.3-09` - Remove `GetTodayWorkoutUseCase`, its test, composition export, `findDayByTypeAndDayNumber` (port and both implementations) and `Weekdays`; fix fallout.
- [ ] `T8.3-10` - `settings.astro` help text.
- [ ] `T8.3-11` - Supabase integration check of `SupabaseRotationQuery` with two users.
- [ ] `T8.3-12` - Run both backends and `typecheck`; Phase 1 regression test.
- [ ] `T8.3-13` - Update docs: mark use case 17 `implemented`, fix the `routines.updated_at` anchor line of the next-workout flow, update the migration table of the routines context (rows removed in 8.3), add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/routines/rotation.test.ts` | unit, table-driven | `computeNextRoutine` and `daysSince` cases (01, 02) |
| `tests/routines/duration-estimate.test.ts` | unit, table-driven | Rule, rounding, minimum, rest 0 (03) |
| `tests/routines/sqlite-rotation.query.test.ts` | repo | Anchor filter, completed only, program only, per-user, last-done map (05, 07, 14) |
| `tests/routines/get-next-workout.use-case.test.ts` | use-case | States, rotation, wrap, archived, migrated user, cards, restart on activate and reorder (04–08) |
| `tests/routines/next-workout-presenter.test.ts` | unit, table-driven | Target text per type, last-done labels (11) |
| `tests/routines/next-workout-route-handler.test.ts` | unit | 200, 401, header (12) |
| `tests/workout-tracking/start-workout.use-case.test.ts` (updated) | use-case | `programId`, `name`, resume in-progress, second workout after completed, race on the partial index (09) |
| `tests/routines/rotation-flow.test.ts` | integration (real SQLite) | Start → log set → complete → next routine advances (09, AC-R8-03) |
| `tests/workout-tracking/phase-1-fixture.regression.test.ts` | integration | Same numbers after removals (13) |
| `tests/supabase/rotation-query.integration.test.ts` | integration | Parity and user isolation on Postgres (14) |

Worked examples (table tests):

| `computeNextRoutine` input | Result |
|---|---|
| routines 1 Push, 2 Pull, 3 Legs; last = undefined | Push |
| same; last = 1 | Pull |
| same; last = 3 | Push |
| Pull archived; last = 1 | Legs |
| Pull archived; last = 2 (Pull itself) | Legs |

| `estimateRoutineMinutes` | Calculation | Result |
|---|---|---|
| 4 exercises × 3 sets, rest `null`, default 90 | 12 × 130 = 1560 s = 26 min, + 5 = 31 | 30 min |
| 1 exercise × 3 sets, 2 warm-ups, rest 60 | 5 × 100 = 500 s ≈ 8.3 min, + 5 = 13.3 | 15 min |
| 1 exercise × 1 set, rest 0 | 40 s ≈ 0.7 min, + 5 = 5.7 | 5 min |

| `daysSince` (last done, now, timezone) | Result |
|---|---|
| `2026-09-01T23:30Z`, `2026-09-02T00:30Z`, UTC | 1 (ayer) |
| same instants, `America/Caracas` (UTC−4) | 0 (hoy) |
| `2026-08-30T10:00Z`, `2026-09-02T09:00Z`, UTC | 3 |

## Out of Scope

- The live workout page and the continue-or-discard choice — story 9.1.
- *Entrenamiento libre* — story 9.1.
- Readiness check-in, recovery widget, fatigue markers in the picker list — story 10.4.
- Offline caching of `/api/routines/next` and offline start — story 12.3.
- Onboarding questionnaire, templates browser and the "Cambiar programa" link in settings — story [8.4](./story-8.4.md).
- Program, routine and builder UI — story [8.2](./story-8.2.md).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
