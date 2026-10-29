---
story_id: "8.2"
round: "round-8"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/routines/readme.md"
size: "L"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["routines"]
  prd_requirements: ["FR-RT-001", "FR-RT-002", "FR-RT-003", "FR-RT-004", "FR-RT-006", "FR-RT-007", "FR-RT-008", "FR-RT-009"]
  architecture_decisions: ["ADR-018"]
  flows: ["build-routine.flow.md"]
blocked_by: ["story-8.1", "story-7.3"]
blocks: ["story-12.5"]
---

# Story 8.2 — Program & routine builder

Parent: [../readme.md](../readme.md)

## Summary

Gives users the Hevy-style plan management of [FR-RT-001..009](../../../prd/features/routines.md): the `/train` page with their programs, create, edit, archive, restore, delete and activate a program, copy a family member's program or routine, and a routine builder that uses the picker from story 7.3 with rep ranges, warm-up sets, rest, RPE, supersets and notes, plus reorder, duplicate, archive and delete of routines. Everything is write-own and validated on the server for both backends. It closes H13 (routine builder with programs, ranges, rest, supersets, notes) and the copy half of H14; "Save a workout as a routine" (H15) is story 9.3.

## Files in scope

**Modify**

- `src/lib/contexts/routines/domain/program.repository.ts` — extends the 8.1 subset with `listByOwner`, `create`, `update`, `setArchived`, `delete`, `hasWorkoutReferences`, `copyProgram`, `copyRoutine`, `findRoutineById`, `findRoutineWithExercises`, `saveRoutine`, `reorderRoutines`, `duplicateRoutine`, `setRoutineArchived`, `deleteRoutine` (signatures in the [context readme](../../../architecture/contexts/routines/readme.md#abstract-classes-contracts)).
- `src/lib/contexts/routines/domain/routines.constants.ts` — adds `ProgramRules.MaxTargetDurationSeconds: 3600` (see [Decisions](#decisions)).
- `src/lib/contexts/routines/infrastructure/sqlite/sqlite-program.repository.ts` and `.../supabase/supabase-program.repository.ts` — implement the new methods.
- `src/lib/contexts/routines/routines.composition.ts` — exports the use cases and `routineCopyPort`.
- `supabase/migrations/006_programs.sql` — adds `duplicate_routine(p_user UUID, p_routine UUID)`, `delete_routine(p_user UUID, p_routine UUID)` and `set_routine_archived(p_user UUID, p_routine UUID, p_archived BOOLEAN)` as `CREATE OR REPLACE FUNCTION` (see [Decisions](#decisions)).
- `src/components/navigation.astro` — adds the link `{ href: '/train', label: 'Train', icon: '🗓️' }`. Story 9.4 replaces this navigation.
- `tests/supabase/programs-functions.integration.test.ts` — also covers the three new functions.

**Create**

- Domain, `src/lib/contexts/routines/domain/`: `routine.validation.ts` (`validateProgramInput`, `validateRoutineInput`), `routine-draft.ts` (pure builder operations), `routine-copy.port.ts`.
- Application, `.../application/`: `list-programs.use-case.ts`, `get-program.use-case.ts`, `create-program.use-case.ts`, `update-program.use-case.ts`, `archive-program.use-case.ts`, `delete-program.use-case.ts`, `copy-program.use-case.ts`, `copy-routine.use-case.ts`, `get-routine.use-case.ts`, `save-routine.use-case.ts`, `reorder-routines.use-case.ts`, `duplicate-routine.use-case.ts`, `archive-routine.use-case.ts`, `delete-routine.use-case.ts`, `routine-copy.adapter.ts`, `program-http-errors.ts` (domain error → `{ status, code }`).
- Pages, `src/pages/`: `train.astro`, `train/programs/[id].astro`, `train/routines/new.astro`, `train/routines/[id]/edit.astro`.
- API, `src/pages/api/`: `programs.ts`, `programs/[id].ts`, `programs/[id]/archive.ts`, `restore.ts`, `activate.ts`, `copy.ts`, `programs/[id]/routines/order.ts`, `routines.ts`, `routines/[id].ts`, `routines/[id]/archive.ts`, `restore.ts`, `duplicate.ts`, `copy.ts`.
- Components, `src/components/`: `program-list.astro`, `program-card.astro`, `routine-builder.tsx`, `routine-exercise-row.tsx`, `program-routines.tsx` (island), `program-destination-dialog.tsx`; `src/lib/client/program-actions.ts`.
- Tests listed in the [Test Plan](#test-plan).

**Not in scope** (must not change): `db/schema.ts` and SQLite migrations, `GetTodayWorkoutUseCase`, `dashboard.astro`, `StartWorkoutUseCase`, the exercise-library code (the picker is consumed as is).

## Happy Path

1. The user opens `/train` (FR-RT-001): *Mis programas* shows non-archived programs, the active one first with the "Activo" badge, and actions *Nuevo programa*, *Biblioteca de ejercicios* and a link *Archivados*.
2. *Nuevo programa* asks for a name (1–60) and an optional description (≤ 500) and creates a program with zero routines (FR-RT-002). The 21st program is refused.
3. On `/train/programs/[id]` the owner taps *Nueva rutina* → `/train/routines/new?program=<id>`. The builder (`routine-builder` island) takes a name (1–60) and notes (≤ 500).
4. *+ Añadir ejercicios* opens the picker in `add` mode; the chosen exercises are appended in selection order with `RoutineExerciseDefaults` (3 × 8–12, no warm-up, rest "Por defecto"; 30–60 s for duration types; range hidden for distance types) (FR-RT-007, FR-RT-008).
5. Per row the user edits sets 1–20, rep range, warm-up sets 0–5, rest 0–600 s in 15 s steps, RPE 6–10, note ≤ 300, links supersets with *Superserie con el siguiente*, reorders, replaces or removes rows.
6. *Guardar* → `POST /api/routines` → `SaveRoutineUseCase`, one transaction, and the user returns to the program with "Rutina guardada" (the routine gets `dayNumber = max + 1`).
7. From the program page the owner reorders routines by drag (`PUT /api/programs/[id]/routines/order`; the rotation restarts, the UI says "El orden cambió. Tu siguiente rutina será «{first}»."), duplicates, archives or deletes (409 `in_use` offers *Archivar*) a routine (FR-RT-009).
8. The owner activates another program (FR-RT-004, `rotationAnchorAt` moves); archives, restores or deletes a program under the active-program and in-use rules (FR-RT-003).
9. Opening a sibling's program shows it read-only with *Guardar programa* and, per routine, *Guardar rutina* (FR-RT-006). Custom exercises of the sibling are skipped and reported: "N ejercicios personalizados no se copiaron".

## Decisions

- **Program-action buttons use a small client script.** The context's endpoints answer JSON, and `DELETE` cannot be an HTML form, so the ⋯ menu of `ProgramCard` and the routine actions use `src/lib/client/program-actions.ts` (buttons with `data-action`, `data-url`, `data-method`, optional `data-confirm`; on 2xx navigate to `data-next`, on 409 show the API message). `components.md` describes PRG forms without JS; the docs task fixes it.
- **Duration targets may exceed 100.** FR-RT-008 states `max ≤ 100`, but a 2-minute plank needs 120 s and the DB check in the schema doc is `≤ 3600`. Domain rule: `1 ≤ min ≤ max ≤ 100` for rep types, `≤ 3600` seconds for duration types (`ProgramRules.MaxTargetDurationSeconds`), `null` pair for distance types. The routines readme's `MaxReps` comment about a DB check of 100 is corrected by the docs task.
- **Three more SQL functions.** The routines readme lists `duplicate_routine` and `delete_routine` as RPCs; renumbering on archive and restore also needs atomicity, so `set_routine_archived` joins them. All three are appended to `006_programs.sql` with `CREATE OR REPLACE FUNCTION`, so re-applying the file to a project that already ran 8.1 is safe. They are `SECURITY INVOKER`, take `p_user` first, and raise `program_not_found` / `routine_limit`.
- **Validation issues.** `RoutineValidationError.issues` is `Array<{ path: string; code: RoutineIssueCode }>` with `path` like `name`, `notes`, `exercises[2].restSeconds` and codes `required`, `too_long`, `out_of_range`, `invalid_value`, `reps_inverted`, `superset_not_contiguous`, `too_many`. The builder corrects `min > max` itself by moving `max` up, so `reps_inverted` only reaches a crafted request.
- **Superset groups** must be contiguous rows; the server renumbers them 1..n and a group with one member becomes `null` (the client does the same through `routine-draft.ts`).
- **Entrenamiento libre and Explorar plantillas are not rendered.** FR-RT-001 lists both, but free workouts arrive with story 9.1 and `/train/templates` with story 8.4; each story adds its entry to `program-list.astro` ([phase rule 7](../readme.md#7-forward-compatible-ui)).
- **Starting a routine from the program page** posts `routine_day_id` to the Phase 1 `POST /api/workouts` form endpoint; story 8.3 makes that workout carry `program_id`.
- **Builder tests** mount the island with `react-dom/client` under happy-dom (`.test.ts`, `React.createElement`), using a fake `fetch` that serves the catalog; the reducer-like logic is tested through `routine-draft.ts`.
- **Reaching a sibling's program** happens by URL in this story; the member profile and feed entries come with story 12.1. `RoutineCopyPort` is built here so story 12.1 can reuse it.

## Acceptance Criteria

- AC-8.2-01: `/train` lists the user's non-archived programs (active first, "Activo" badge) and links to the exercise library; `?archived=1` lists archived programs; no session redirects to `/login` (FR-RT-001).
- AC-8.2-02: `CreateProgramUseCase` validates name 1–60 and description ≤ 500, creates a program with `ownerId = userId`, no routines and `rotationAnchorAt = now`, and throws `ProgramLimitReachedError` (409 `program_limit`) at 20 owned programs, archived included (FR-RT-002).
- AC-8.2-03: `UpdateProgramUseCase`, `ArchiveProgramUseCase`, `DeleteProgramUseCase` and the activate endpoint (`SetActiveProgramUseCase` from story 8.1) enforce ownership (`ProgramOwnershipError`, 403), refuse templates (`TemplateImmutableError`), refuse archive and delete of the active program (`ActiveProgramError`, 409), refuse activating an archived one (`ProgramArchivedError`, 409), and refuse delete when `hasWorkoutReferences` is true (`ProgramInUseError`, 409 `in_use`); restore reverses archive (FR-RT-003, FR-RT-004).
- AC-8.2-04: Activating a program writes `profiles.active_program_id` and sets `rotationAnchorAt` to the injected `now`; editing a program never moves the anchor (FR-RT-004, FR-RT-013).
- AC-8.2-05: `validateRoutineInput` enforces every FR-RT-008 rule: name 1–60, notes ≤ 500, ≤ 30 exercises, sets 1–20, `1 ≤ min ≤ max ≤ 100` (≤ 3600 for duration types, null pair for distance types), warm-up 0–5, rest `null` or 0–600 in 15 s steps, RPE `null` or 6–10, note ≤ 300, contiguous supersets renumbered 1..n.
- AC-8.2-06: `SaveRoutineUseCase` creates a routine (`dayNumber = max + 1`, 15th routine → `RoutineLimitReachedError` 409) or fully replaces an existing one in one transaction: `exerciseOrder` 1..n, `targetReps = targetRepsMax` (10 when the range is hidden), previous exercise rows gone; a failure leaves the old routine intact. A foreign program raises `ProgramOwnershipError`, a template `TemplateImmutableError`, an archived program `ProgramArchivedError`.
- AC-8.2-07: A new exercise id that `ExerciseCatalogPort.findUsableByIds` does not return raises `ExerciseNotPickableError` (400), while exercises already stored in the routine (for example an archived custom one) save without error and are shown with an "Archivado" badge (FR-EL-008, FR-EL-009).
- AC-8.2-08: `routine-draft.ts` adds exercises with the defaults per exercise type, links and unlinks supersets (dragging a row out of a group dissolves a one-member group), moves rows, and on replace keeps the targets unless the type kind changes (rep ↔ duration ↔ distance), which resets the range to that kind's default (FR-RT-008, [build-routine flow](../../../architecture/contexts/routines/flows/build-routine.flow.md)).
- AC-8.2-09: `ReorderRoutinesUseCase` accepts only the exact set of non-archived routine ids, rewrites `dayNumber` 1..k (archived after), moves the rotation anchor, and rejects a different set with 400; `DuplicateRoutineUseCase` appends "{name} (copia)" truncated to 60 with all exercises and does not move the anchor; at 14 routines it raises `RoutineLimitReachedError` (FR-RT-009).
- AC-8.2-10: `DeleteRoutineUseCase` raises `RoutineInUseError` (409 `in_use`, UI offers *Archivar*) when a workout references the routine, otherwise deletes it and compacts the remaining `dayNumber`s keeping their relative order; `ArchiveRoutineUseCase` moves archived routines behind active ones without restarting the rotation (FR-RT-009).
- AC-8.2-11: `CopyProgramUseCase` and `CopyRoutineUseCase` deep-copy a sibling's program or routine into the user's own rows (new ids, `sourceTemplateId` null), skip exercises that are not pickable and report them in `skippedExercises`, create "Copiadas" when no target is given, honour the 20-program and 14-routine limits, and leave the source untouched; a template source goes through `AdoptTemplateUseCase` instead (FR-RT-006).
- AC-8.2-12: `/train/programs/[id]` is editable only for the owner; a sibling sees it read-only with *Guardar programa* and *Guardar rutina* and the skipped-exercises message; templates answer 404 on `GET /api/programs/[id]`; builder pages answer 403 for a non-owner.
- AC-8.2-13: The builder island keeps all edits in memory, enables *Guardar* only for a valid draft, asks "¿Descartar cambios?" on *Cancelar* or back navigation with a dirty state and registers `beforeunload`, marks a rejected exercise "No disponible" without losing the draft, and shows "Necesitas conexión para guardar la rutina" offline (FR-RT-007).
- AC-8.2-14: Both backends pass the same repository behaviour: SQLite via `db.transaction` and code guards, Supabase via `copy_program`, `copy_routine`, `save_routine`, `reorder_routine_days` and the three new functions; as a **non-owner** on Supabase the repository raises the typed error before the write and direct RLS-checked writes affect no row (AC-R8-02).
- AC-8.2-15: `RoutineCopyAdapter` implements `RoutineCopyPort.listTargetPrograms` and `copyRoutine` over `ListProgramsUseCase` and `CopyRoutineUseCase` for story 12.1.

## Tasks

- [ ] `T8.2-01` - `routine.validation.ts` with `RoutineIssueCode` and table-driven tests (AC-05).
- [ ] `T8.2-02` - `routine-draft.ts` pure operations and tests (AC-08).
- [ ] `T8.2-03` - Extend `ProgramRepository` and implement it in `SqliteProgramRepository` (programs CRUD, `hasWorkoutReferences`, copies, `saveRoutine` transaction, reorder, duplicate, archive, delete with compaction).
- [ ] `T8.2-04` - Add `duplicate_routine`, `delete_routine`, `set_routine_archived` to `006_programs.sql`; implement `SupabaseProgramRepository` new methods through the RPCs and map error codes to domain errors.
- [ ] `T8.2-05` - Program use cases: list, get, create, update, archive, delete (tests per use case).
- [ ] `T8.2-06` - Copy use cases, `RoutineCopyPort` and `RoutineCopyAdapter` (tests).
- [ ] `T8.2-07` - Routine use cases: get, save, reorder, duplicate, archive, delete (tests).
- [ ] `T8.2-08` - Composition exports and `program-http-errors.ts`; program endpoints with auth and JSON errors.
- [ ] `T8.2-09` - Routine endpoints and the `routines/order` endpoint; handler tests for status mapping.
- [ ] `T8.2-10` - `program-list.astro`, `program-card.astro`, `program-actions.ts`, `/train` page, navigation link.
- [ ] `T8.2-11` - `/train/programs/[id]` with `program-routines.tsx` (drag and button reorder, duplicate, archive, delete) and the sibling read-only view with `program-destination-dialog.tsx`.
- [ ] `T8.2-12` - `routine-builder.tsx`, `routine-exercise-row.tsx`, builder pages (`new`, `edit`), unsaved-changes guard.
- [ ] `T8.2-13` - Extend the Supabase integration tests (functions and non-owner repository cases).
- [ ] `T8.2-14` - Run both backends and `typecheck`; Phase 1 regression test still passes.
- [ ] `T8.2-15` - Update docs: mark use cases 1–6, 9–16 `implemented` (7 is 8.1), fix the PRG-forms, `MaxReps` and function-list drift, add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/routines/routine.validation.test.ts` | unit, table-driven | One row per FR-RT-008 rule, superset contiguity and renumbering (05) |
| `tests/routines/routine-draft.test.ts` | unit, table-driven | Defaults per type, superset link, move, replace, range reset (08) |
| `tests/routines/sqlite-program.repository.test.ts` (extended) | repo | CRUD, transaction rollback, copies with skipped exercises, reorder and compaction keep `dayNumber` dense, `hasWorkoutReferences`, ownership guards, templates immutable (02, 06, 09, 10, 11, 14) |
| `tests/routines/create-program.use-case.test.ts`, `update-program…`, `archive-program…`, `delete-program…` | use-case | Limits, ownership, active and in-use rules, anchor untouched by edits (02, 03, 04) |
| `tests/routines/save-routine.use-case.test.ts` | use-case | Create, replace, limits, pickable check, foreign and template programs (06, 07) |
| `tests/routines/reorder-routines.use-case.test.ts`, `duplicate-routine…`, `archive-routine…`, `delete-routine…` | use-case | Exact set, anchor, name suffix, compaction (09, 10) |
| `tests/routines/copy-program.use-case.test.ts`, `copy-routine…`, `routine-copy.adapter.test.ts` | use-case | Skipped exercises, "Copiadas", limits, template source, port (11, 15) |
| `tests/routines/program-http-errors.test.ts`, `programs-route-handlers.test.ts` | unit | Status and code per domain error, 401 / 403 / 404 (03, 12) |
| `tests/routines/routine-builder.test.ts` | component (happy-dom) | Draft flow, validity gating, dirty guard, "No disponible", offline (13) |
| `tests/routines/program-routines.test.ts` | component (happy-dom) | Reorder call, `in_use` fallback to *Archivar* (09, 10) |
| `tests/supabase/programs-functions.integration.test.ts` (extended) | integration | Seven functions on Postgres, error codes (14) |
| `tests/supabase/program-repository.integration.test.ts` | integration-RLS | As a **non-owner**: typed errors, zero-row direct writes, copies allowed (14) |

Worked example for `ReorderRoutinesUseCase` and `DeleteRoutineUseCase` (table tests):

| Start (`dayNumber`: name, state) | Operation | Result |
|---|---|---|
| 1 Push, 2 Pull, 3 Legs | reorder `[Legs, Push, Pull]` | Legs 1, Push 2, Pull 3; anchor = `now` |
| 1 Push, 2 Pull, 3 Legs | archive Pull | Push 1, Legs 2, Pull 3 (archived); anchor unchanged |
| 1 Push, 2 Legs, 3 Pull (archived) | restore Pull | Push 1, Legs 2, Pull 3 (last among active) |
| 1 Push, 2 Pull, 3 Legs | delete Pull (no workouts) | Push 1, Legs 2 |
| 1 Push, 2 Pull, 3 Legs | reorder `[Push, Pull]` | 400, the set differs |

## Out of Scope

- Rotation, "Siguiente: …" card, `GET /api/routines/next`, readiness hints — story [8.3](./story-8.3.md).
- Templates browser, preview, adopt endpoint, onboarding, *Explorar plantillas* link — story [8.4](./story-8.4.md).
- *Entrenamiento libre* action and the new workout start — story 9.1.
- *Guardar como rutina* from a completed workout (`SaveWorkoutAsRoutineUseCase`) — story 9.3.
- Family entry points to copy (feed, member profile, workout detail) — story 12.1.
- Offline editing of routines — not planned (ADR-025 outbox covers workouts only).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
