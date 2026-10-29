# Glossary

Parent: [./readme.md](./README.md)

Domain terms used across documentation. Terms introduced in Phase 2 ([stories/phase-2](./stories/phase-2/readme.md)) are marked *(Phase 2)*.

## A

| Term | Definition | Canonical home |
|------|------------|----------------|
| Activity | *(Phase 2)* Likes and comments other users left on my workouts, listed at `/activity`, newest first. Items newer than `profiles.activity_seen_at` show a dot on the Inicio tab; opening `/activity` marks them seen. | [architecture/contexts/social/readme.md](./architecture/contexts/social/readme.md) |
| ADR | Architecture Decision Record. Documents a significant architectural decision. | [architecture/decisions/readme.md](./architecture/decisions/readme.md) |
| Adapter | Concrete class that implements a domain port. Lives in infrastructure layer. | [architecture/decisions/007-repository-pattern.md](./architecture/decisions/007-repository-pattern.md) |
| Auth | Authentication. Supabase Auth with email/password. | [architecture/contexts/auth/readme.md](./architecture/contexts/auth/readme.md) |

## B

| Term | Definition | Canonical home |
|------|------------|----------------|
| Body measurement | *(Phase 2)* One owner-only, dated `body_measurements` row: body weight (kg), body-fat % and up to 14 circumferences (cm). At most one per user per day. Never visible to other users. | [architecture/decisions/023-body-metrics-privacy.md](./architecture/decisions/023-body-metrics-privacy.md), [prd/features/body-metrics.md](./prd/features/body-metrics.md) |

## C

| Term | Definition | Canonical home |
|------|------------|----------------|
| Calories | Energy unit for nutrition. Measured in kcal. | [architecture/contexts/nutrition/readme.md](./architecture/contexts/nutrition/readme.md) |
| Comment | *(Phase 2)* Plain-text message (1–500 characters) on a completed workout. The author can edit or delete it; the workout owner can delete any comment on their workout. | [architecture/decisions/024-social-interactions.md](./architecture/decisions/024-social-interactions.md) |
| Completed | Workout status. Requires ≥1 entry. | [architecture/contexts/workout-tracking/readme.md](./architecture/contexts/workout-tracking/readme.md) |
| Composition Root | Per-context file that wires concrete adapters to abstract ports. | [architecture/decisions/010-per-context-composition.md](./architecture/decisions/010-per-context-composition.md) |
| Custom exercise | *(Phase 2)* Exercise created by a user (`exercises.owner_id` = that user). Visible to everyone, editable only by its owner, archived instead of deleted. | [architecture/decisions/017-exercise-catalog.md](./architecture/decisions/017-exercise-catalog.md) |

## D

| Term | Definition | Canonical home |
|------|------------|----------------|
| Deload | *(Phase 2)* Program-wide week of reduced load (sets × 0.6, weight × 0.9, reps at the range minimum). Suggested, never forced; active while `profiles.deload_until` is in the future. | [architecture/decisions/021-progression-engine.md](./architecture/decisions/021-progression-engine.md) |
| Domain | Business rules, invariants, entities, value objects. | [architecture/contexts/readme.md](./architecture/contexts/readme.md) |
| Double progression | *(Phase 2)* Progression rule: keep the weight and add reps until every working set reaches the top of the rep range, then add one increment and restart at the range minimum. | [architecture/decisions/021-progression-engine.md](./architecture/decisions/021-progression-engine.md) |
| Drop set | *(Phase 2)* Set type `drop`, label `D`: a set done right after another with less weight. Counts for volume; ignored by progression. | [architecture/decisions/016-workout-data-model-v2.md](./architecture/decisions/016-workout-data-model-v2.md) |
| DTO | Data Transfer Object. Shape of data passed between layers. | [architecture/contexts/*/readme.md](./architecture/contexts/) |

## E

| Term | Definition | Canonical home |
|------|------------|----------------|
| e1RM (Epley) | *(Phase 2)* Estimated one-rep max: `weight × (1 + reps / 30)`; with 1 rep it equals the weight. Computed only for 1–12 reps. | [architecture/decisions/020-personal-records.md](./architecture/decisions/020-personal-records.md) |
| Entity | Domain object with identity. Has `id` field. | [architecture/contexts/*/readme.md](./architecture/contexts/) |
| Equipment | *(Phase 2)* Exercise attribute: `barbell`, `dumbbell`, `machine`, `cable`, `kettlebell`, `bodyweight`, `band`, `plate`, `smith_machine`, `other`. Decides the progression increment. | [architecture/decisions/017-exercise-catalog.md](./architecture/decisions/017-exercise-catalog.md) |
| Exercise | A specific gym movement. Has `name`, `muscle_group`. Phase 2 adds equipment, exercise type, secondary muscles, instructions and custom exercises. | [architecture/contexts/exercise-library/readme.md](./architecture/contexts/exercise-library/readme.md) |
| Exercise type | *(Phase 2)* One of `weight_reps`, `bodyweight_reps`, `weighted_bodyweight`, `assisted_bodyweight`, `duration`, `distance_duration`, `weight_distance`. Decides which set fields are required. | [architecture/decisions/016-workout-data-model-v2.md](./architecture/decisions/016-workout-data-model-v2.md), [ADR-017](./architecture/decisions/017-exercise-catalog.md) |
| Exposure | *(Phase 2)* One completed workout with ≥ 1 completed working set (`normal` or `failure`) of an exercise. Progression looks at the last 3 exposures. | [architecture/decisions/021-progression-engine.md](./architecture/decisions/021-progression-engine.md) |

## F

| Term | Definition | Canonical home |
|------|------------|----------------|
| Failure set | *(Phase 2)* Set type `failure`, label `F`: a set taken to muscular failure. Counts as a working set. | [architecture/decisions/016-workout-data-model-v2.md](./architecture/decisions/016-workout-data-model-v2.md) |
| Feed | *(Phase 2)* Inicio tab list of the completed workouts of every other user, newest first, 20 per page. There is no follow graph. | [architecture/contexts/social/readme.md](./architecture/contexts/social/readme.md), [ADR-024](./architecture/decisions/024-social-interactions.md) |
| Flow | End-to-end behavior across UI, application, domain, persistence. Files use `.flow.md`. | [architecture/contexts/*/flows/](./architecture/contexts/) |
| FR | Functional Requirement. Tracked in PRD features. | [prd/features/requirements-index.md](./prd/features/requirements-index.md) |

## H

| Term | Definition | Canonical home |
|------|------------|----------------|
| Hexagonal Architecture | Ports and adapters pattern. Domain at center, adapters at edges, wired by composition. | [architecture/decisions/013-hexagonal-architecture.md](./architecture/decisions/013-hexagonal-architecture.md) |
| Hombre | **Phase 1 template tag.** Male value of `profiles.routine_type` / `routines.type`. Since Phase 2 it is only an onboarding hint and the tag of the "Male 5-Day Split" template. | [architecture/decisions/018-user-owned-programs.md](./architecture/decisions/018-user-owned-programs.md) |

## I

| Term | Definition | Canonical home |
|------|------------|----------------|
| Increment | *(Phase 2)* Smallest load step progression adds to an exercise, by equipment and body region (e.g. barbell lower body 5 kg, upper body 2.5 kg). | [architecture/decisions/021-progression-engine.md](./architecture/decisions/021-progression-engine.md) |
| Infrastructure | Adapters, endpoints, DTOs, persistence. Implements domain ports. | [architecture/contexts/readme.md](./architecture/contexts/readme.md) |
| Invariant | Business rule that MUST always be true. | [architecture/contexts/*/readme.md](./architecture/contexts/) |
| In Progress | Workout status. Initial state when workout started. | [architecture/contexts/workout-tracking/readme.md](./architecture/contexts/workout-tracking/readme.md) |

## K

| Term | Definition | Canonical home |
|------|------------|----------------|
| kg | Kilograms. Internal weight storage unit. | [architecture/decisions/006-kg-storage.md](./architecture/decisions/006-kg-storage.md) |

## L

| Term | Definition | Canonical home |
|------|------------|----------------|
| lbs | Pounds. Display unit for users who prefer imperial. | [architecture/decisions/006-kg-storage.md](./architecture/decisions/006-kg-storage.md) |
| Like | *(Phase 2)* ❤️ on another user's completed workout. At most one per user per workout; never on your own workout. | [architecture/decisions/024-social-interactions.md](./architecture/decisions/024-social-interactions.md) |

## M

| Term | Definition | Canonical home |
|------|------------|----------------|
| Macros | Macronutrients: protein, carbs, fat. Measured in grams. | [architecture/contexts/nutrition/readme.md](./architecture/contexts/nutrition/readme.md) |
| Mujer | **Phase 1 template tag.** Female value of `profiles.routine_type` / `routines.type`. Since Phase 2 it is only an onboarding hint and the tag of the "Female Glute Focus 5-Day" template. | [architecture/decisions/018-user-owned-programs.md](./architecture/decisions/018-user-owned-programs.md) |
| Muscle recovery | *(Phase 2)* Derived per-muscle recovery % from the hard sets of the last 7 days and a 48 h / 72 h window. States: `fresh`, `recovering`, `fatigued`. | [architecture/decisions/022-readiness-and-recovery.md](./architecture/decisions/022-readiness-and-recovery.md) |

## N

| Term | Definition | Canonical home |
|------|------------|----------------|
| Next workout | *(Phase 2)* The routine of the active program that follows the last completed one in rotation order. Shown on Inicio as "Siguiente: …". | [architecture/decisions/019-rotation-scheduling-and-onboarding.md](./architecture/decisions/019-rotation-scheduling-and-onboarding.md) |
| NFR | Non-Functional Requirement. | [prd/features/requirements-index.md](./prd/features/requirements-index.md) |
| NutritionEntry | One analyzed meal. Has calories, macros, food items. | [architecture/contexts/nutrition/readme.md](./architecture/contexts/nutrition/readme.md) |

## O

| Term | Definition | Canonical home |
|------|------------|----------------|
| Outbox | *(Phase 2)* IndexedDB queue of live-workout commands (`upsert-set`, `finish-workout`, …) that the sync worker sends to the API in order. Lets the live workout work offline. | [architecture/decisions/025-offline-live-workout.md](./architecture/decisions/025-offline-live-workout.md) |

## P

| Term | Definition | Canonical home |
|------|------------|----------------|
| Personal record (PR) | *(Phase 2)* A completed, non-warm-up set that strictly beats the user's previous best for a record type (heaviest weight, best e1RM, …). The first exposure to an exercise gives no PR. Derived on demand, not stored. | [architecture/decisions/020-personal-records.md](./architecture/decisions/020-personal-records.md) |
| Plateau | *(Phase 2)* An exercise with ≥ 4 exposures whose best e1RM (best reps for rep-only types) has not improved over the last 3 exposures. | [architecture/decisions/021-progression-engine.md](./architecture/decisions/021-progression-engine.md) |
| Port | Interface defined in domain. Implemented by infrastructure adapters. Cross-context ports: [contexts readme](./architecture/contexts/readme.md#cross-context-ports-phase-2). | [architecture/contexts/*/readme.md](./architecture/contexts/) |
| Previous (column) | *(Phase 2)* The *Anterior* column of the live workout: the same-position set of the same exercise in the user's most recent completed workout containing it. | [prd/features/workout-tracking.md → FR-WT-029](./prd/features/workout-tracking.md#fr-wt-029) |
| Primary / secondary muscle | *(Phase 2)* `exercises.muscle_group` is the primary muscle (one `MuscleGroups` value); `secondary_muscles` is a JSON list. Secondary muscles count 0.5 in recovery and muscle distribution. | [architecture/decisions/017-exercise-catalog.md](./architecture/decisions/017-exercise-catalog.md) |
| Profile | User profile. Has display_name, routine_type, weight_unit. Phase 2 adds training settings, onboarding answers, `active_program_id`, deload state and `activity_seen_at`. | [architecture/contexts/user/readme.md](./architecture/contexts/user/readme.md) |
| Program | *(Phase 2)* A `routines` row: a folder of routines (Hevy "folder"). A user may own several; one is active (`profiles.active_program_id`). | [architecture/decisions/018-user-owned-programs.md](./architecture/decisions/018-user-owned-programs.md) |
| ProgressPhoto | Private photo for tracking body progress. | [architecture/contexts/private-photos/readme.md](./architecture/contexts/private-photos/readme.md) |
| PWA | *(Phase 2)* Progressive Web App: installable shell (`manifest.webmanifest` + hand-written service worker) that keeps a started workout usable offline. | [architecture/decisions/025-offline-live-workout.md](./architecture/decisions/025-offline-live-workout.md) |

## R

| Term | Definition | Canonical home |
|------|------------|----------------|
| Readiness | *(Phase 2)* Optional pre-workout check-in (sleep, energy, soreness, 1–5). The score is their average; a low score reduces the session's suggestions. Owner-only. | [architecture/decisions/022-readiness-and-recovery.md](./architecture/decisions/022-readiness-and-recovery.md) |
| Rep max | *(Phase 2)* Record type `rep_max`: the best weight lifted for at least N reps, N = 1–12 (the rep-records table). | [architecture/decisions/020-personal-records.md](./architecture/decisions/020-personal-records.md) |
| RLS | Row Level Security. Supabase feature for data isolation. | [architecture/database-schema.md](./architecture/database-schema.md) |
| Rotation | *(Phase 2)* Scheduling rule: the routines of the active program follow each other by position (`day_number`), not by weekday. | [architecture/decisions/019-rotation-scheduling-and-onboarding.md](./architecture/decisions/019-rotation-scheduling-and-onboarding.md) |
| Routine | **Phase 2:** a `routine_days` row — one session plan (e.g. "Push A") inside a program. **Phase 1:** the whole predefined 5-day plan, now called a program or template. | [architecture/decisions/018-user-owned-programs.md](./architecture/decisions/018-user-owned-programs.md) |
| RoutineDay | Table `routine_days`. Has day_number, day_name, focus. Domain term since Phase 2: **Routine**; `day_number` is its rotation position. | [architecture/database-schema.md](./architecture/database-schema.md) |
| RoutineExercise | Exercise in a routine day. Has target_sets, target_reps. Phase 2 adds a rep range, warm-up sets, rest, superset group, target RPE and notes. | [architecture/database-schema.md](./architecture/database-schema.md) |
| RPE | *(Phase 2)* Rate of Perceived Exertion of a set, 6–10 in 0.5 steps. Optional; shown when `profiles.rpe_enabled`. | [architecture/decisions/016-workout-data-model-v2.md](./architecture/decisions/016-workout-data-model-v2.md) |

## S

| Term | Definition | Canonical home |
|------|------------|----------------|
| Seed Data | Pre-populated data in DB. Routines and exercises. | [architecture/decisions/003-routines-seed-data.md](./architecture/decisions/003-routines-seed-data.md) |
| Set | One group of repetitions of an exercise. | [architecture/contexts/workout-tracking/readme.md](./architecture/contexts/workout-tracking/readme.md) |
| Set type | *(Phase 2)* `workout_entries.set_type`: `normal`, `warmup`, `drop`, `failure`. Labels `W` / `D` / `F`; normal sets show their ordinal. | [architecture/decisions/016-workout-data-model-v2.md](./architecture/decisions/016-workout-data-model-v2.md) |
| Signed URL | Temporary secure URL for private storage files. Expires in 1 hour. | [architecture/contexts/private-photos/readme.md](./architecture/contexts/private-photos/readme.md) |
| Streak | Consecutive days with completed workouts. Phase 2 adds the weekly streak (FR-PR-017). | [architecture/contexts/progress/readme.md](./architecture/contexts/progress/readme.md) |
| Superset | *(Phase 2)* Exercises of one workout or routine with the same non-null `superset_group`, done back to back. | [architecture/decisions/016-workout-data-model-v2.md](./architecture/decisions/016-workout-data-model-v2.md) |

## T

| Term | Definition | Canonical home |
|------|------------|----------------|
| Template | *(Phase 2)* A program with `owner_id IS NULL` (`is_template = true`): seeded, read-all, immutable. Users adopt it by deep copy. | [architecture/decisions/018-user-owned-programs.md](./architecture/decisions/018-user-owned-programs.md) |
| Tombstone | *(Phase 2)* `deleted_at` marker on a deleted workout exercise or set. Kept 30 days so a stale offline upsert cannot bring the row back. | [architecture/decisions/025-offline-live-workout.md](./architecture/decisions/025-offline-live-workout.md) |

## U

| Term | Definition | Canonical home |
|------|------------|----------------|
| Use Case | Single business action in the application layer. Orchestrates domain and ports. | [architecture/contexts/readme.md](./architecture/contexts/readme.md) |

## V

| Term | Definition | Canonical home |
|------|------------|----------------|
| Value Object | Domain object without identity. Defined by its values. | [architecture/contexts/*/readme.md](./architecture/contexts/) |
| Volume | Total weight lifted. Calculated: sets × reps × weight. | [architecture/contexts/progress/readme.md](./architecture/contexts/progress/readme.md) |

## W

| Term | Definition | Canonical home |
|------|------------|----------------|
| Warm-up set | *(Phase 2)* Set type `warmup`, label `W`. Excluded from personal records and progression. | [architecture/decisions/016-workout-data-model-v2.md](./architecture/decisions/016-workout-data-model-v2.md) |
| WeightUnit | User preference: 'kg' or 'lbs'. | [architecture/decisions/006-kg-storage.md](./architecture/decisions/006-kg-storage.md) |
| Workout | One gym session. Has status, date, entries. Phase 2 adds a name, notes and free (routine-less) workouts. | [architecture/contexts/workout-tracking/readme.md](./architecture/contexts/workout-tracking/readme.md) |
| Workout exercise | *(Phase 2)* `workout_exercises` row: one exercise at one position in a workout, with rest, notes and superset group. It owns the sets. | [architecture/decisions/016-workout-data-model-v2.md](./architecture/decisions/016-workout-data-model-v2.md) |
| WorkoutEntry | One set of one exercise in a workout. Since Phase 2 it belongs to a workout exercise. | [architecture/contexts/workout-tracking/readme.md](./architecture/contexts/workout-tracking/readme.md) |
