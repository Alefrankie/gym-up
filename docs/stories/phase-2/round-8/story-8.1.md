---
story_id: "8.1"
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
  prd_requirements: ["FR-RT-005", "FR-RT-017"]
  architecture_decisions: ["ADR-018"]
  flows: ["adopt-template.flow.md"]
blocked_by: ["story-7.2"]
blocks: ["story-8.2", "story-8.3", "story-8.4"]
---

# Story 8.1 — Programs schema, templates seed, user migration

Parent: [../readme.md](../readme.md)

## Summary

Turns the Phase 1 routine tables into user-owned programs ([ADR-018](../../../architecture/decisions/018-user-owned-programs.md), [ADR-019](../../../architecture/decisions/019-rotation-scheduling-and-onboarding.md) §1 for the rotation anchor): migration 006 adds ownership, metadata, ranges, rest, supersets and RPE columns, the two Phase 1 routines become templates **in place**, five more templates are seeded, and every existing user receives an adopted, active copy of the template matching their `routine_type`. It also ships the five transactional Supabase functions, the deep-copy repository method, `AdoptTemplateUseCase` and `SetActiveProgramUseCase` (data side of FR-RT-005 and FR-RT-017). It has **no UI**: the Phase 1 dashboard keeps reading routines by `routine_type` and keeps working on the template days until story 8.3. Prerequisite for H13 and H14; G1 and G2 build on it.

## Files in scope

**Modify**

- `db/schema.ts` — `routines` (nullable `type`, `ownerId`, `slug`, `sourceTemplateId`, `description`, `isTemplate`, `level`, `goal`, `daysPerWeek`, `equipmentProfile`, `focus`, `isArchived`, `createdAt`, `updatedAt`, `rotationAnchorAt`, `uq_routines_slug`, `idx_routines_owner`), `routineDays` (`notes`, `isArchived`), `routineExercises` (`targetRepsMin`, `targetRepsMax`, `warmupSets`, `restSeconds`, `supersetGroup`, `targetRpe`, `notes`), `profiles` (`activeProgramId`, `trainingGoal`, `experienceLevel`, `daysPerWeek`, `equipmentProfile`, `focus`, `onboardingCompletedAt`). Shapes: [routines context → schema](../../../architecture/contexts/routines/readme.md#schema-dbschemats-story-81).
- `db/migrations/meta/_journal.json` — entry for `0006_programs`.
- `db/seed.ts` — `main()` calls `seedProgramTemplates(db)` and then `migrateUsersToPrograms(db)` after the exercise seed.
- `package.json` — scripts `db:seed:programs` (`tsx db/seed-program-templates.ts`) and `db:generate-program-templates` (`tsx scripts/generate-program-templates-sql.ts`).
- `src/pages/dashboard.astro` — the routine heading prints `focus` only when it differs from `dayName`, because migration 006 sets template `day_name = focus` and the Phase 1 heading would read "X — X" until story 8.3 replaces the card.
- `src/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-routine.repository.ts` and `.../supabase/supabase-routine.repository.ts` — type fallout of `routines.type` becoming nullable; lookups by type keep resolving the two templates.
- `tests/workout-tracking/test-db.ts`, `tests/progress/test-db.ts`, `tests/public-view/test-db.ts` — hand-written DDL gains the 006 columns of `routines`, `routine_days`, `routine_exercises`, `profiles`.
- `tests/workout-tracking/phase-1-fixture.regression.test.ts` — also runs 0006 plus the seeds and asserts the 8.1 expectations.

**Create**

- `db/migrations/0006_programs.sql` (hand-written, see [Decisions](#decisions)).
- `supabase/migrations/006_programs.sql` — DDL, RLS, data steps and the five functions of [database-schema.md → 006](../../../architecture/database-schema.md#006--programs-adr-018-adr-019); the template insert block is generated.
- `db/seed-data/program-templates.ts` — the seven templates (metadata, Spanish description, routines, exercises by name).
- `db/seed-program-templates.ts` (exports `seedProgramTemplates(db)`), `db/migrate-users-to-programs.ts` (exports `migrateUsersToPrograms(db)`), `scripts/generate-program-templates-sql.ts`.
- `src/lib/contexts/routines/domain/`: `routines.types.ts`, `routines.constants.ts`, `routines.errors.ts` (the files of the context readme), `program.repository.ts` and `profile-program-settings.ts` (the subset below).
- `src/lib/contexts/routines/application/adopt-template.use-case.ts`, `set-active-program.use-case.ts`.
- `src/lib/contexts/routines/infrastructure/sqlite/sqlite-program.repository.ts`, `sqlite-profile-program-settings.ts`; `.../supabase/supabase-program.repository.ts`, `supabase-profile-program-settings.ts`.
- `src/lib/contexts/routines/routines.composition.ts`.
- `tests/routines/test-db.ts`, `tests/routines/mothers/` (`program.mother.ts`, `routine.mother.ts`, `routine-exercise.mother.ts`) and the tests of the [Test Plan](#test-plan).

**Not in scope** (must not change): `GetTodayWorkoutUseCase`, `StartWorkoutUseCase`, `routine.repository.ts` (still serves the Phase 1 workout page), every other page and component.

## Happy Path

1. A developer applies `0006_programs` (SQLite) or `006_programs` (Postgres). The columns, indexes, RLS policies, the `DEFERRABLE` unique constraints and the five functions are created.
2. Data steps run: the Phase 1 `hombre` and `mujer` routines get their `slug` (`male-5-day-split`, `female-glute-focus-5-day`), `is_template = true` and the metadata of the template table; their `routine_days.day_name` becomes the day's `focus`; each routine exercise gets `target_reps_min/max` 8–12 (from `target_reps` 10) and `rest_seconds` 90, or 120 for the first exercise of the day. Their IDs never change, so Phase 1 workouts stay linked.
3. Templates 3–7 are inserted (Full Body Beginner 3-Day, Upper / Lower 4-Day, Push Pull Legs 6-Day, Dumbbell Full Body 3-Day, Bodyweight Home 3-Day) with exercises resolved by name from the 107-exercise catalog.
4. For every profile without `active_program_id`, `migrateUsersToPrograms` (SQLite) or the migration's loop (Postgres) calls `adoptTemplate(LegacyRoutineTemplate[routine_type], userId)`, sets `profiles.active_program_id` and `rotation_anchor_at = now`. Phase 1 workouts keep their template `routine_day_id` and have `program_id = NULL`.
5. The user opens the app: `/dashboard`, `/history`, `/progress` and `/family` behave as before (history day names now show the day's focus, an intended consequence of step 2).
6. Later stories call `AdoptTemplateUseCase.execute({ userId, slug, activate })` and the Supabase functions through the repositories.

## Decisions

- **Hand-written SQLite migration.** Same reason as story 7.1 (snapshots stop at 0001): write `0006_programs.sql` by hand, add the journal entry. `routines` is rebuilt, because `type` loses `NOT NULL` and SQLite rejects `ADD COLUMN … DEFAULT (unixepoch())` for `created_at`, `updated_at` and `rotation_anchor_at`; `routine_days`, `routine_exercises` and `profiles` only gain columns with constant defaults. SQLite has no unique index on `routine_days(routine_id, day_number)` or `routine_exercises(routine_day_id, exercise_order)` (the Phase 1 SQLite migrations never created them), so reordering needs no deferral there.
- **Rebuild safety gate.** `routines` is the parent of `routine_days` (`ON DELETE CASCADE`) and of `routine_exercises` through it, so the rebuild must not cascade-delete them. Apply the same gate as story 7.1: the regression test compares row counts of `routines`, `routine_days`, `routine_exercises`, `workouts` before and after and runs `PRAGMA foreign_key_check`; reuse `db/migrate.ts` if story 7.1 introduced it.
- **Postgres uniqueness is `DEFERRABLE INITIALLY DEFERRED`** (the SQL in the schema doc). The routines context readme says `INITIALLY IMMEDIATE`; the schema doc is the DDL source, and either value lets one `UPDATE … SET day_number = CASE …` permute positions.
- **Templates 3–7 routine `focus`.** `routine_days.focus` is `NOT NULL`, so new templates store `focus = day_name` (for example "Push A"); the dashboard tweak above hides the repeated subtitle.
- **Template descriptions** are written in Spanish (1–2 sentences, shown in the preview of story 8.4), names stay English as in the schema table.
- **Seed semantics.** `seedProgramTemplates` is idempotent by `slug`: templates 1 and 2 are updated in place (found by `routines.type`), templates 3–7 are inserted only when the slug is missing, and the metadata of existing templates is refreshed. Content of an existing template is never rewritten, because adopted copies and Phase 1 history reference it; changing content needs a new migration. A missing exercise name throws.
- **Generated Postgres block.** `scripts/generate-program-templates-sql.ts` rewrites the section between `-- BEGIN GENERATED TEMPLATES` and `-- END GENERATED TEMPLATES` in `006_programs.sql`; a unit test regenerates it in memory and compares. Exercise IDs are resolved in SQL by `lower(name)` among system rows.
- **Function signatures follow the schema doc** (`p_user` first, for example `adopt_template(p_user UUID, p_template UUID) RETURNS UUID`); the context readme lists them without `p_user`. All are `SECURITY INVOKER`, so `p_user` must equal `auth.uid()` when called by the app. Errors are raised as `RAISE EXCEPTION '<code>'` with codes `program_not_found`, `routine_limit`, `invalid_order`, mapped to domain errors by the repositories (story 8.2). `copy_program` and `copy_routine` skip routine exercises whose exercise has `owner_id` set to someone else and re-densify `exercise_order`. `save_routine` takes the `SaveRoutineInput` JSON; `reorder_routine_days` rewrites `day_number` 1..n (listed ids first, archived routines after, in their previous order) and sets `rotation_anchor_at = NOW()`.
- **`SetActiveProgramUseCase` moves here.** The context's use-case table assigns it to 8.2, but `AdoptTemplateUseCase` (this story) activates through it. Story 8.2 adds only its endpoint and UI. The docs task fixes the table.
- **Ports are declared as subsets.** `ProgramRepository` declares `findById`, `findWithRoutines`, `countByOwner`, `listTemplates`, `findTemplateBySlug`, `adoptTemplate`, `touchRotationAnchor`; `ProfileProgramSettings` declares `find` and `setActiveProgram`. Story 8.2 extends the first, story 8.4 the second, so no abstract method exists without an implementation.
- **No API or page** in this story: the adopt endpoint ships with story 8.4.

## Acceptance Criteria

- AC-8.1-01: Applying 0006 / 006 to an empty database and to the Phase 1 fixture succeeds, the column lists of `routines`, `routine_days`, `routine_exercises` and `profiles` match `db/schema.ts`, and Postgres has `DEFERRABLE INITIALLY DEFERRED` unique constraints on `routine_days(routine_id, day_number)` and `routine_exercises(routine_day_id, exercise_order)` plus `CHECK (day_number BETWEEN 1 AND 14)`.
- AC-8.1-02: The fixture's two routines keep their IDs and become templates: slugs, `is_template = true`, level, goal, days, equipment and focus per the template table; `routine_days.day_name = focus`; routine exercises have `target_reps_min = 8`, `target_reps_max = 12`, `rest_seconds` 120 for `exercise_order = 1` and 90 otherwise; the 56 routine exercises and 10 routine days are all still present.
- AC-8.1-03: After `seedProgramTemplates` there are exactly 7 templates (`owner_id IS NULL`, `is_template = true`) with routine counts 5, 5, 3, 4, 6, 3, 3 in seed order; every routine exercise of templates 3–7 points to a system exercise and matches the sets, rep range and rest of the [schema tables](../../../architecture/database-schema.md#program-templates-seed) (table-driven over all rows).
- AC-8.1-04: Running `seedProgramTemplates` twice changes nothing; a template slug that already exists keeps its routines and exercises untouched while its metadata is refreshed.
- AC-8.1-05: `ProgramRepository.adoptTemplate(templateId, userId)` creates a program with `ownerId = userId`, `sourceTemplateId = templateId`, `isTemplate = false`, `slug = null`, `type = null`, the same level, goal, days, equipment, focus and description, a fresh `rotationAnchorAt`; copies every routine (same `dayNumber`, `dayName`, `focus`, `notes`) and every routine exercise (all target columns, same `exerciseOrder`) with new IDs; the template rows are byte-identical afterwards, and editing the copy never changes the template.
- AC-8.1-06: `AdoptTemplateUseCase` throws `TemplateNotFoundError` for an unknown slug and `ProgramLimitReachedError` when the user already owns 20 programs (archived included); with `activate = true` (default) it sets `profiles.active_program_id` and the anchor, with `false` the active program is unchanged; adopting the same template twice creates two independent programs.
- AC-8.1-07: `SetActiveProgramUseCase` activates an owned, non-archived program and moves `rotationAnchorAt` to the injected `now`; another user's program or a template (no owner) raises `ProgramOwnershipError`, an archived program raises `ProgramArchivedError`, and a missing id raises `ProgramNotFoundError`.
- AC-8.1-08: `migrateUsersToPrograms` gives every profile without `active_program_id` an adopted copy of `LegacyRoutineTemplate[routineType]`, sets it active with `rotationAnchorAt` equal to the injected `now`, leaves `onboarding_completed_at` null, skips profiles that already have an active program, and a second run changes nothing (AC-R8-01).
- AC-8.1-09: After migration, Phase 1 workouts still reference their original template `routine_day_id` with `program_id = NULL`, `GetTodayWorkoutUseCase` still resolves the template days for a user's `routine_type`, and `/history`, `/progress`, `/family` return the numbers of `phase-1.expected.json`; history day names equal `routine_days.focus`; row counts of `routines` children and `workouts` are unchanged and `PRAGMA foreign_key_check` is empty (AC-R8-01, phase rule 6).
- AC-8.1-10: Supabase functions: `adopt_template` produces the same deep copy as the SQLite repository; `copy_program` copies a sibling's program, skips exercises owned by a third user and leaves `exercise_order` dense; `copy_routine` appends at `max(day_number) + 1` and raises `routine_limit` at 14; `save_routine` creates, then replaces the exercises of an existing routine in one call; `reorder_routine_days` permutes `day_number` in one statement without a unique violation, moves `rotation_anchor_at`, and raises `invalid_order` when the id set differs.
- AC-8.1-11: RLS as a **non-owner** (AC-R8-05): cannot update or delete a sibling's program, cannot insert `routine_days` or `routine_exercises` into it, cannot update, delete or insert a template row (`owner_id IS NULL`); can read templates and sibling programs; can copy them through `copy_program` / `copy_routine` into their own program.
- AC-8.1-12: `TemplateSeedOrder` equals the `slug` order of the seed data, `LegacyRoutineTemplate` resolves both Phase 1 types, and `routines.composition.ts` builds with `STORAGE_BACKEND=sqlite` and `=supabase`.

## Tasks

- [ ] `T8.1-01` - `db/schema.ts` changes for `routines`, `routineDays`, `routineExercises`, `profiles`.
- [ ] `T8.1-02` - `db/migrations/0006_programs.sql` (rebuild of `routines`, added columns, backfill of ranges, template data steps) plus journal entry; confirm with `drizzle-kit generate` that no diff remains.
- [ ] `T8.1-03` - `supabase/migrations/006_programs.sql`: DDL, RLS, data steps 1–3 of the schema doc, with the two Phase 1 templates updated in place.
- [ ] `T8.1-04` - The five SQL functions (`adopt_template`, `copy_program`, `copy_routine`, `save_routine`, `reorder_routine_days`) and their error codes.
- [ ] `T8.1-05` - `db/seed-data/program-templates.ts` with the seven templates and Spanish descriptions; data-shape tests.
- [ ] `T8.1-06` - `routines.types.ts`, `routines.constants.ts`, `routines.errors.ts` and constant tests (seed order, legacy mapping).
- [ ] `T8.1-07` - Ports `ProgramRepository` (subset) and `ProfileProgramSettings` (subset).
- [ ] `T8.1-08` - `SqliteProgramRepository.adoptTemplate` (one transaction) and the read methods; repository tests.
- [ ] `T8.1-09` - `SqliteProfileProgramSettings` and `AdoptTemplateUseCase`, `SetActiveProgramUseCase` with tests.
- [ ] `T8.1-10` - `seedProgramTemplates(db)` and `migrateUsersToPrograms(db)`, wiring in `db/seed.ts`, npm scripts; tests.
- [ ] `T8.1-11` - `scripts/generate-program-templates-sql.ts` and the in-sync test for the generated block.
- [ ] `T8.1-12` - Supabase repositories (`adopt_template` through RPC) and `routines.composition.ts`.
- [ ] `T8.1-13` - Phase 1 compatibility: `routine.repository.ts` type fallout, `dashboard.astro` heading, the three `test-db.ts` DDLs, regression test extension.
- [ ] `T8.1-14` - `tests/supabase/rls-programs.integration.test.ts` and `programs-functions.integration.test.ts`.
- [ ] `T8.1-15` - Run both backends and `typecheck`.
- [ ] `T8.1-16` - Update docs: mark `AdoptTemplateUseCase`, `SetActiveProgramUseCase` and `seedProgramTemplates(db)` rows `implemented` (and fix the story column of `SetActiveProgramUseCase` to 8.1), reconcile the function list and signatures with `database-schema.md`, fix the `INITIALLY IMMEDIATE` and `rotation anchor` drift in the next-workout flow, add Implementation Evidence.

## Test Plan

| Test file | Type | What it proves (AC ids) |
|---|---|---|
| `tests/routines/program-templates-data.test.ts` | unit, table-driven over all template rows | Counts, exercise names exist in `EXERCISE_SEED`, sets / ranges / rest per schema doc, seed order (03, 12) |
| `tests/routines/seed-program-templates.test.ts` | repo (real SQLite) | 7 templates, in-place Phase 1 conversion, idempotency, metadata refresh (02, 03, 04) |
| `tests/routines/sqlite-program.repository.test.ts` | repo | Deep-copy equality, template untouched, copy isolation, `countByOwner`, `touchRotationAnchor` (05) |
| `tests/routines/adopt-template.use-case.test.ts` | use-case | Unknown slug, limit 20, activate on and off, twice (06) |
| `tests/routines/set-active-program.use-case.test.ts` | use-case | Owned, archived, foreign, template, anchor with injected `now` (07) |
| `tests/routines/migrate-users-to-programs.test.ts` | use-case / repo | Mapping per `routine_type`, skip, idempotency, anchor, onboarding null (08) |
| `tests/routines/generate-program-templates-sql.test.ts` | unit | Generated block equals the committed block (03) |
| `tests/workout-tracking/phase-1-fixture.regression.test.ts` (extended) | integration | Same numbers, counts, `foreign_key_check`, names = focus, Phase 1 dashboard lookup (01, 02, 09) |
| `tests/db/migrate.test.ts` (extended) | unit | 0006 file and journal entry present (01) |
| `tests/supabase/programs-functions.integration.test.ts` | integration | The five functions on a real Postgres (01, 10) |
| `tests/supabase/rls-programs.integration.test.ts` | integration-RLS | Non-owner write attempts fail, templates immutable, reads and copies succeed (11) |
| `tests/routines/composition.test.ts` | unit | Both backends build (12) |

Worked example for the user migration (table test):

| Profile | `routine_type` | `active_program_id` before | After migration |
|---|---|---|---|
| Ana | `mujer` | NULL | active = copy of `female-glute-focus-5-day`, 5 routines, anchor = migration time |
| Beto | `hombre` | NULL | active = copy of `male-5-day-split`, 5 routines |
| Carla | `mujer` | existing program id | unchanged, no extra copy |

## Out of Scope

- Builder, program list, reorder, duplicate, archive, delete, copy endpoints and their repository methods — story [8.2](./story-8.2.md). The `copy_program`, `copy_routine`, `save_routine` and `reorder_routine_days` functions exist here but have no caller until then.
- Rotation and the dashboard card, removing the rest-day picker, `routine_type` in settings — story [8.3](./story-8.3.md).
- Questionnaire, recommendation, templates browser, adopt endpoint and `profiles` onboarding writes — story [8.4](./story-8.4.md).
- Removing `routine.repository.ts` and `GetTodayWorkoutUseCase`'s dependency on it — stories 8.3 and 9.1.
- `duplicate_routine` and `delete_routine` functions — story 8.2.

## Implementation Evidence

_To be filled on completion (PR link, test run summary, screenshots)._
