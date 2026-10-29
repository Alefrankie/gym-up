---
story_id: "7.4"
round: "round-7"
phase: "phase-2"
parent_spec: "../../../architecture/contexts/exercise-library/readme.md"
size: "S"
status: "ready"
started: "TBD"
completed: "TBD"
owner: "TBD"
implements:
  architecture_features: ["exercise-library"]
  prd_requirements: ["FR-EL-006", "FR-EL-007", "FR-EL-008", "FR-EL-009"]
  architecture_decisions: ["ADR-017"]
  flows: ["create-custom-exercise.flow.md", "pick-exercises.flow.md"]
blocked_by: ["story-7.3"]
blocks: ["story-12.5"]
---

# Story 7.4 — Custom exercises

Parent: [../readme.md](../readme.md)

## Summary

Lets a user create, edit, archive and restore their own exercises, with the validation, uniqueness and type-lock rules of [FR-EL-006..008](../../../prd/features/exercise-library.md#fr-el-006). A sibling sees the exercise's details but can never add it to their own workouts or routines (FR-EL-009). Creation is also available inline inside the picker, which returns the new exercise already selected. It closes H12 (custom exercises) and completes AC-R7-05.

## Files in scope

**Modify**

- `src/lib/contexts/exercise-library/domain/exercise-library.errors.ts` — adds `ExerciseOwnershipError`, `SystemExerciseImmutableError`, `CustomExerciseValidationError`, `DuplicateExerciseNameError`, `ExerciseTypeLockedError`.
- `src/lib/contexts/exercise-library/domain/custom-exercise.repository.ts` — adds `create`, `update`, `archive`, `restore` to the class declared in 7.3.
- `src/lib/contexts/exercise-library/infrastructure/sqlite/sqlite-custom-exercise.repository.ts` and `.../supabase/supabase-custom-exercise.repository.ts` — implement the writes.
- `src/lib/contexts/exercise-library/exercise-library.composition.ts` — exports the four use cases.
- `src/pages/api/exercises.ts` (POST), `src/pages/api/exercises/[id].ts` (PATCH).
- `src/pages/exercises.astro`, `src/components/exercise-library-list.tsx` — *+ Crear ejercicio*, *Archivados* link, `?archived=1` view with *Restaurar*, *Crear «{query}»* in the empty state.
- `src/pages/exercises/[id].astro` — owner actions *Editar*, *Archivar* / *Restaurar*.
- `src/components/exercise-picker.tsx` — *+ Crear ejercicio* swaps the sheet content for `CustomExerciseForm` and returns the new exercise selected.
- `src/lib/client/exercise-catalog.ts` — adds `addToCatalogCache(item)`.

**Create**

- `src/lib/contexts/exercise-library/domain/custom-exercise.validation.ts` — `validateCustomExercise(input): ValidationIssue[]`.
- `src/lib/contexts/exercise-library/application/create-custom-exercise.use-case.ts`, `update-custom-exercise.use-case.ts`, `archive-custom-exercise.use-case.ts`, `restore-custom-exercise.use-case.ts`, `exercise-http-errors.ts` (domain error → `{ status, code }`).
- `src/pages/api/exercises/[id]/archive.ts`, `src/pages/api/exercises/[id]/restore.ts`.
- `src/pages/exercises/new.astro`, `src/pages/exercises/[id]/edit.astro`.
- `src/components/custom-exercise-form.tsx`.
- Tests listed in the [Test Plan](#test-plan).

**Not in scope** (must not change): `db/schema.ts`, migrations (the `exercises_insert_own` and `exercises_update_own` policies and the unique indexes shipped in 7.1), progress and workout-tracking code.

## Happy Path

1. On `/exercises` the user taps *+ Crear ejercicio* (or *Crear «{query}»* from an empty search, which prefills the name) and lands on `/exercises/new`.
2. The user fills the form of FR-EL-006 (name, primary muscle, 0–3 secondary muscles, equipment, type, optional instructions and `https://` video). Each field is validated on blur with the same `validateCustomExercise` the server uses.
3. *Guardar* → `POST /api/exercises` → `CreateCustomExerciseUseCase`: trim, validate, system-name check, own-name check, insert with `ownerId = userId`. The user lands on `/exercises/[id]` with the toast "Ejercicio creado".
4. In the picker the same form opens inline. After `201` the exercise joins the in-memory catalog, is selected with the next order number (`add`) or confirmed immediately (`replace`).
5. The owner opens *Editar* → `/exercises/[id]/edit` and changes fields. When sets already reference the exercise, the *Tipo* select is disabled with "No se puede cambiar el tipo porque ya tiene series registradas".
6. The owner taps *Archivar*, confirms "¿Archivar ejercicio? Seguirá en tu historial y en las rutinas que ya lo usan." and the exercise leaves the list and the picker. *Archivados* (`/exercises?archived=1`) lists it with *Restaurar*.
7. A sibling opens the same exercise (a link from a later feed) and sees it read-only; `PATCH`, archive and restore return 403, and it never appears in their list or picker (FR-EL-009).

## Decisions

- **Validation messages** (Spanish, one per `CustomExerciseIssueCode`; the PRD gives only the duplicate messages):

  | Code | Message |
  |---|---|
  | `required` | "Campo obligatorio" |
  | `too_short` | "Mínimo 2 caracteres" |
  | `too_long` | "Máximo {n} caracteres" (60 for the name, 2000 for instructions) |
  | `invalid_value` | "Valor no válido" |
  | `too_many` | "Máximo 3 músculos secundarios" |
  | `duplicate_of_primary` | "El músculo secundario no puede ser el principal" |
  | `not_https` | "El enlace debe empezar por https://" |
  | duplicate, scope `system` | "Ya existe en la biblioteca" |
  | duplicate, scope `own` | "Ya tienes un ejercicio con ese nombre" |
  | duplicate, scope `own_archived` | "Ya tienes un ejercicio archivado con ese nombre. Restáuralo desde Archivados" |

- **Secondary muscles are de-duplicated before validation**, so `["chest","chest"]` is stored once rather than rejected (Hevy's multi-select cannot produce duplicates).
- **Offline.** *Guardar* and the creation entries are disabled while `navigator.onLine` is false, with "Necesitas conexión para crear ejercicios". Nothing is queued (the context flow decision).
- **Type lock** looks only at logged data (`workout_exercises` or `workout_entries` rows), not at routines: a routine target does not carry metrics ([FR-EL-007](../../../prd/features/exercise-library.md#fr-el-007)).
- **Ownership violations answer 403** (`ExerciseOwnershipError` for another user's exercise, `SystemExerciseImmutableError` for system rows), as in the context error table; `ExerciseNotFoundError` answers 404 and is checked first.
- **Race on names.** A unique-index violation (`UNIQUE constraint failed` in SQLite, Postgres `23505`) maps to `DuplicateExerciseNameError('own')`.

## Acceptance Criteria

- AC-7.4-01: `validateCustomExercise` reports one issue per violated rule of FR-EL-006: name required, 2–60 characters after trim, primary muscle, equipment and type required and in the closed enums, 0–3 secondary muscles none equal to the primary, instructions ≤ 2000 characters, video URL `https://` only; a valid input yields no issue.
- AC-7.4-02: `CreateCustomExerciseUseCase` trims fields, turns empty `instructions` and `videoUrl` into `null`, rejects a name equal to a system name ignoring case and surrounding spaces (`DuplicateExerciseNameError('system')`, HTTP 409 `duplicate_name`), rejects the user's own name including archived rows (`'own'`, `'own_archived'`), and inserts with `ownerId = userId`; the same name under two owners is allowed (FR-EL-006).
- AC-7.4-03: `UpdateCustomExerciseUseCase` is owner-only: another user gets `ExerciseOwnershipError` (403), a system row `SystemExerciseImmutableError` (403), an unknown id `ExerciseNotFoundError` (404); renaming checks uniqueness excluding the exercise itself; changing `exerciseType` while `hasLoggedSets` is true raises `ExerciseTypeLockedError` (409 `type_locked`), while other fields still update (FR-EL-007).
- AC-7.4-04: `ArchiveCustomExerciseUseCase` and `RestoreCustomExerciseUseCase` are owner-only and idempotent; an archived exercise disappears from `GET /api/exercises` and the picker, stays in `/history`, in routines that already use it and in stats, and its name stays reserved (creating the same name returns scope `own_archived`) (FR-EL-008).
- AC-7.4-05: `/exercises/new` prefills the name from `?name=`, shows field messages from the table above on blur and from the API `issues`, disables *Guardar* while a field is invalid or while offline, and after `201` redirects to `/exercises/[id]` with "Ejercicio creado".
- AC-7.4-06: `/exercises/[id]/edit` returns 403 for a non-owner and disables the *Tipo* select with the hint when `isTypeLocked`; `/exercises?archived=1` lists only the user's archived exercises with *Restaurar*; the detail page shows *Editar* and *Archivar* only to the owner.
- AC-7.4-07: In the picker, *+ Crear ejercicio* opens the form inline; on `201` the exercise is added to the cached catalog and selected with the next order number (`add`) or confirmed (`replace`); *Cancelar* returns to the list with the selection intact (FR-EL-005, FR-EL-006).
- AC-7.4-08: FR-EL-009 end to end: after user A creates an exercise, user B can read its detail ("Creado por A"), does not get it in `GET /api/exercises` or the picker, and `ExerciseCatalogPort.findUsableByIds` omits it; B's `PATCH`, archive and restore return 403 (AC-R7-05).
- AC-7.4-09: Both backends enforce the same rules: SQLite through repository guards, Supabase through the repository pre-check plus RLS `exercises_insert_own` / `exercises_update_own` (a direct client update by a non-owner affects zero rows, and the repository raises the typed error before it).

## Tasks

- [ ] `T7.4-01` - `custom-exercise.validation.ts` and the four new error classes; table-driven validation tests.
- [ ] `T7.4-02` - Extend `CustomExerciseRepository` and implement the writes in `SqliteCustomExerciseRepository` (ownership and system guards, unique-index mapping).
- [ ] `T7.4-03` - `SupabaseCustomExerciseRepository` writes (pre-check, `23505` mapping).
- [ ] `T7.4-04` - `CreateCustomExerciseUseCase` and `UpdateCustomExerciseUseCase` with tests.
- [ ] `T7.4-05` - `ArchiveCustomExerciseUseCase`, `RestoreCustomExerciseUseCase` and composition exports, with tests.
- [ ] `T7.4-06` - `exercise-http-errors.ts` and the endpoints POST, PATCH, archive, restore (JSON `{ error: { code, message, issues? } }`).
- [ ] `T7.4-07` - `custom-exercise-form.tsx` with blur validation, offline guard, locked-type hint.
- [ ] `T7.4-08` - Pages `/exercises/new`, `/exercises/[id]/edit`, detail actions, *Archivados* view, empty-state link.
- [ ] `T7.4-09` - Inline create in `exercise-picker.tsx` and `addToCatalogCache`.
- [ ] `T7.4-10` - `tests/supabase/custom-exercise.integration.test.ts` (non-owner write attempts, duplicate mapping).
- [ ] `T7.4-11` - Update docs: mark the four custom-exercise use cases `implemented` in the exercise-library context, fix any drift (for example error-to-HTTP table), add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/exercise-library/custom-exercise.validation.test.ts` | unit, table-driven | One row per FR-EL-006 rule (01) |
| `tests/exercise-library/create-custom-exercise.use-case.test.ts` | use-case | Trim, null normalisation, system / own / own-archived duplicates, per-owner names (02) |
| `tests/exercise-library/update-custom-exercise.use-case.test.ts` | use-case | Ownership, system immutability, rename uniqueness, type lock (03) |
| `tests/exercise-library/archive-custom-exercise.use-case.test.ts` | use-case | Idempotent archive and restore, reserved name, history untouched (04) |
| `tests/exercise-library/sqlite-custom-exercise.repository.test.ts` (extended) | repo | Guards, case-insensitive unique index counting archived rows, `UNIQUE` mapping (02, 04, 09) |
| `tests/exercise-library/exercise-http-errors.test.ts` | unit | Each domain error maps to its status and code (03) |
| `tests/exercise-library/custom-exercise-form.test.ts` | component (happy-dom) | Blur validation, messages, offline disable, locked type, prefill (05, 06) |
| `tests/exercise-library/exercise-picker.test.ts` (extended) | component (happy-dom) | Inline create selects the new exercise, cancel keeps selection (07) |
| `tests/exercise-library/family-visibility.test.ts` | use-case | Sibling reads detail, absent from list and `findUsableByIds`, 403 on writes (08) |
| `tests/supabase/custom-exercise.integration.test.ts` | integration-RLS | As a **non-owner**: typed error on update, archive and restore; direct update affects zero rows; can read; `23505` mapping (08, 09) |

Worked example for `validateCustomExercise`:

| Input (changes from a valid base) | Issues |
|---|---|
| `name: " a "` | `name` `too_short` |
| `name: 61 × "x"` | `name` `too_long` |
| `muscleGroup: "chest"`, `secondaryMuscles: ["chest"]` | `secondaryMuscles` `duplicate_of_primary` |
| `secondaryMuscles: ["triceps","shoulders","biceps","forearms"]` | `secondaryMuscles` `too_many` |
| `videoUrl: "http://youtu.be/x"` | `videoUrl` `not_https` |
| `videoUrl: "https://youtu.be/x"`, `instructions: null` | none |
| `instructions: 2001 × "x"` | `instructions` `too_long` |
| `equipment: "sofa"` | `equipment` `invalid_value` |

## Out of Scope

- Showing the exercise in the family feed and member profile — story 12.1 (the exercise detail page already reads it here).
- Copying a sibling's routine with custom exercises (they are skipped and reported) — story [8.2](../round-8/story-8.2.md).
- Real *Historial*, *Gráficas* and *Récords* tabs of the detail page — stories 10.1 and 11.2.
- Queuing exercise creation offline — not planned (ADR-025 has no such outbox command).
- Hosted video or image upload — not planned (ADR-017 §4).

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
