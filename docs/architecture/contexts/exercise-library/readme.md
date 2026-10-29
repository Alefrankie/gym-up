# Exercise Library Context

Parent: [../readme.md](../readme.md) · PRD: [../../../prd/features/exercise-library.md](../../../prd/features/exercise-library.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Phase | 2 |
| Last edited | 2026-10-01 |

Decisions: [ADR-017](../../decisions/017-exercise-catalog.md) (catalog), [ADR-016 §3](../../decisions/016-workout-data-model-v2.md) (exercise-type metrics), [ADR-025](../../decisions/025-offline-live-workout.md) (catalog caching). Schema: [004 — Workout model v2](../../database-schema.md#004--workout-model-v2-adr-016-adr-017) (columns), [005 — Exercise library seed](../../database-schema.md#005--exercise-library-seed-adr-017), [Exercise Library Seed](../../database-schema.md#exercise-library-seed) (data). Stories: [7.1](../../../stories/phase-2/round-7/story-7.1.md) (schema), [7.2](../../../stories/phase-2/round-7/story-7.2.md) (seed), [7.3](../../../stories/phase-2/round-7/story-7.3.md) (browse, detail, picker), [7.4](../../../stories/phase-2/round-7/story-7.4.md) (custom exercises).

## Purpose

Owns the `exercises` table: the seeded **system catalog** (107 exercises, `owner_id IS NULL`) and **custom exercises** (`owner_id = me`). Provides browse, search, filters, the exercise detail page, the exercise picker used by the live workout and the routine builder, and the read-only `ExerciseCatalogPort` every other context uses to read exercise metadata (`equipment`, `exercise_type`, muscles).

Out of scope: the data of the Historial / Gráficas / Récords tabs of the detail page. They are rendered on this context's page, but their data comes from the progress context ([FR-PR-011..013](../../../prd/features/progress.md#fr-pr-011)). See [UI → Pages](#pages).

---

## Domain

File naming: **kebab-case**. Domain files in `src/lib/contexts/exercise-library/domain/`.

### Schema (`db/schema.ts`, story 7.1)

The Drizzle table replaces the Phase 1 `exercises` definition (`name` loses `.unique()`). Enum arrays are inline (Phase 1 style) and MUST equal the domain constants below; a test asserts it.

```ts
// db/schema.ts (excerpt) — 0005_workout_model_v2.sql / supabase 004_workout_model_v2.sql
export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    muscleGroup: text('muscle_group').notNull(), // primary muscle, a MuscleGroups value
    secondaryMuscles: text('secondary_muscles', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    equipment: text('equipment', {
      enum: ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight', 'band', 'plate', 'smith_machine', 'other'],
    }).notNull().default('other'),
    exerciseType: text('exercise_type', {
      enum: ['weight_reps', 'bodyweight_reps', 'weighted_bodyweight', 'assisted_bodyweight', 'duration', 'distance_duration', 'weight_distance'],
    }).notNull().default('weight_reps'),
    instructions: text('instructions'), // Markdown, numbered steps (Spanish)
    videoUrl: text('video_url'),
    ownerId: text('owner_id').references(() => profiles.id, { onDelete: 'cascade' }), // NULL = system
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex('uq_exercises_system_name').on(sql`lower(${t.name})`).where(sql`owner_id IS NULL`),
    uniqueIndex('uq_exercises_owner_name').on(t.ownerId, sql`lower(${t.name})`).where(sql`owner_id IS NOT NULL`),
    index('idx_exercises_owner').on(t.ownerId),
  ],
);
export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
```

### `exercise-library.types.ts`

```ts
// src/lib/contexts/exercise-library/domain/exercise-library.types.ts
import type { Exercise } from '@db/schema';
import type { MuscleGroup, Equipment, ExerciseType } from './exercise-library.constants';

/** Read view shared with other contexts through ExerciseCatalogPort. */
export type CatalogExercise = Pick<
  Exercise,
  'id' | 'name' | 'equipment' | 'exerciseType' | 'ownerId' | 'isArchived'
> & {
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
};

/** Row returned by GET /api/exercises. No instructions (payload size). */
export interface ExerciseListItem {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  exerciseType: ExerciseType;
  isCustom: boolean; // ownerId !== null → "Personalizado" tag
}

export interface ExerciseCatalogView {
  exercises: ExerciseListItem[]; // sorted by name (sortByName)
  recentIds: string[];           // ≤ ExerciseCatalogRules.RecentLimit, newest first
}

/** FR-EL-002. AND across groups, OR within a group. An empty group means no filter. */
export interface ExerciseFilter {
  query?: string;
  muscleGroups?: MuscleGroup[];
  equipment?: Equipment[];
}

/** FR-EL-006 form payload (trimmed by the use case). */
export interface CustomExerciseInput {
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  exerciseType: ExerciseType;
  instructions: string | null;
  videoUrl: string | null;
}
export type CustomExercisePatch = Partial<CustomExerciseInput>;

export interface ExerciseDetail {
  exercise: Exercise;
  isCustom: boolean;
  isOwn: boolean;
  canEdit: boolean;                // isOwn && isCustom
  isTypeLocked: boolean;           // FR-EL-007: hasLoggedSets
  ownerDisplayName: string | null; // a family member's custom exercise (FR-EL-009)
}

export type MetricRequirement = 'required' | 'optional' | 'forbidden';
export type WeightSign = 'non_negative' | 'zero' | 'non_positive';

export interface ExerciseTypeMetrics {
  reps: MetricRequirement;
  weight: MetricRequirement;
  weightSign: WeightSign;
  durationSeconds: MetricRequirement;
  distanceM: MetricRequirement;
}

export type CustomExerciseIssueCode =
  | 'required' | 'too_short' | 'too_long' | 'invalid_value'
  | 'too_many' | 'duplicate_of_primary' | 'not_https';

export interface ValidationIssue {
  field: keyof CustomExerciseInput;
  code: CustomExerciseIssueCode;
}

export type PickRejection = 'not_found' | 'archived' | 'not_owner';
```

### `exercise-library.constants.ts`

```ts
// src/lib/contexts/exercise-library/domain/exercise-library.constants.ts

/** ADR-017 §2 — Hevy taxonomy. */
export const MuscleGroups = {
  Abdominals: 'abdominals', Abductors: 'abductors', Adductors: 'adductors',
  Biceps: 'biceps', Calves: 'calves', Cardio: 'cardio', Chest: 'chest',
  Forearms: 'forearms', FullBody: 'full_body', Glutes: 'glutes',
  Hamstrings: 'hamstrings', Lats: 'lats', LowerBack: 'lower_back', Neck: 'neck',
  Quadriceps: 'quadriceps', Shoulders: 'shoulders', Traps: 'traps',
  Triceps: 'triceps', UpperBack: 'upper_back', Other: 'other',
} as const;
export type MuscleGroup = (typeof MuscleGroups)[keyof typeof MuscleGroups];

/** FR-EL-011 */
export const MuscleGroupLabels: Record<MuscleGroup, string> = {
  abdominals: 'Abdominales', abductors: 'Abductores', adductors: 'Aductores',
  biceps: 'Bíceps', calves: 'Gemelos', cardio: 'Cardio', chest: 'Pecho',
  forearms: 'Antebrazos', full_body: 'Cuerpo completo', glutes: 'Glúteos',
  hamstrings: 'Isquiotibiales', lats: 'Dorsales', lower_back: 'Lumbar', neck: 'Cuello',
  quadriceps: 'Cuádriceps', shoulders: 'Hombros', traps: 'Trapecios',
  triceps: 'Tríceps', upper_back: 'Espalda alta', other: 'Otro',
};

/** Primary muscles the system catalog is NOT required to cover (FR-EL-010). */
export const UncoveredMuscleGroups: readonly MuscleGroup[] = ['neck', 'other'];

export const Equipments = {
  Barbell: 'barbell', Dumbbell: 'dumbbell', Machine: 'machine', Cable: 'cable',
  Kettlebell: 'kettlebell', Bodyweight: 'bodyweight', Band: 'band', Plate: 'plate',
  SmithMachine: 'smith_machine', Other: 'other',
} as const;
export type Equipment = (typeof Equipments)[keyof typeof Equipments];

/** FR-EL-011 */
export const EquipmentLabels: Record<Equipment, string> = {
  barbell: 'Barra', dumbbell: 'Mancuernas', machine: 'Máquina', cable: 'Polea',
  kettlebell: 'Kettlebell', bodyweight: 'Peso corporal', band: 'Banda', plate: 'Disco',
  smith_machine: 'Multipower', other: 'Otro',
};

/** ADR-016 §3 / ADR-017 §2 */
export const ExerciseTypes = {
  WeightReps: 'weight_reps',
  BodyweightReps: 'bodyweight_reps',
  WeightedBodyweight: 'weighted_bodyweight',
  AssistedBodyweight: 'assisted_bodyweight',
  Duration: 'duration',
  DistanceDuration: 'distance_duration',
  WeightDistance: 'weight_distance',
} as const;
export type ExerciseType = (typeof ExerciseTypes)[keyof typeof ExerciseTypes];

/** Decision: labels follow Hevy's type names (the PRD does not list them). */
export const ExerciseTypeLabels: Record<ExerciseType, string> = {
  weight_reps: 'Peso y repeticiones',
  bodyweight_reps: 'Repeticiones (peso corporal)',
  weighted_bodyweight: 'Peso corporal + lastre',
  assisted_bodyweight: 'Peso corporal asistido',
  duration: 'Duración',
  distance_duration: 'Distancia y duración',
  weight_distance: 'Peso y distancia',
};

/**
 * ADR-016 §3 metric table, consumed by workout-tracking set validation and the
 * live-workout inputs. Cells the ADR leaves as "—" are 'forbidden' (Hevy behaviour:
 * a type shows only its own inputs), except duration.weight, which the ADR makes optional.
 * A forbidden weight is stored as 0 (NOT NULL column); other forbidden metrics are NULL.
 */
export const ExerciseTypeMetricRules: Record<ExerciseType, ExerciseTypeMetrics> = {
  weight_reps:         { reps: 'required',  weight: 'required',  weightSign: 'non_negative', durationSeconds: 'forbidden', distanceM: 'forbidden' },
  bodyweight_reps:     { reps: 'required',  weight: 'forbidden', weightSign: 'zero',         durationSeconds: 'forbidden', distanceM: 'forbidden' },
  weighted_bodyweight: { reps: 'required',  weight: 'required',  weightSign: 'non_negative', durationSeconds: 'forbidden', distanceM: 'forbidden' },
  assisted_bodyweight: { reps: 'required',  weight: 'required',  weightSign: 'non_positive', durationSeconds: 'forbidden', distanceM: 'forbidden' },
  duration:            { reps: 'forbidden', weight: 'optional',  weightSign: 'non_negative', durationSeconds: 'required',  distanceM: 'forbidden' },
  distance_duration:   { reps: 'forbidden', weight: 'forbidden', weightSign: 'zero',         durationSeconds: 'required',  distanceM: 'required' },
  weight_distance:     { reps: 'forbidden', weight: 'required',  weightSign: 'non_negative', durationSeconds: 'forbidden', distanceM: 'required' },
};

/** FR-EL-006 */
export const CustomExerciseRules = {
  NameMinLength: 2,
  NameMaxLength: 60,
  MaxSecondaryMuscles: 3,
  InstructionsMaxLength: 2000,
  VideoUrlProtocol: 'https:',
} as const;

/** FR-EL-002, FR-EL-004, FR-EL-010, NFR-EL-01 */
export const ExerciseCatalogRules = {
  RecentLimit: 8,
  RecentScanEntries: 200, // latest completed sets scanned to build Recientes
  SearchDebounceMs: 150,
  MinSystemExercises: 100,
  MinInstructionSteps: 2,
  MaxInstructionSteps: 6,
} as const;
```

### Pure domain functions

| File | Export | Rule |
|---|---|---|
| `exercise-filter.ts` | `normalizeSearchText(s)` | `s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()` |
| | `matchesExerciseFilter(item, filter)` | Substring of the normalized name; AND across groups, OR within (FR-EL-002). Shared by the picker, `/exercises` and `ExerciseCatalogRepository.search` |
| | `sortByName(items)` | `a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })`. Sorting lives in the domain so SQLite and Postgres collations cannot diverge |
| `custom-exercise.validation.ts` | `validateCustomExercise(input): ValidationIssue[]` | FR-EL-006 field rules. No uniqueness (needs I/O) |
| `exercise-pickability.ts` | `canPick(exercise or undefined, userId): PickRejection or null` | `not_found`; `archived`; `not_owner` when `ownerId !== null && ownerId !== userId` (ADR-017 §1, FR-EL-009) |

### `exercise-library.errors.ts`

| Error | Thrown by | HTTP |
|---|---|---|
| `ExerciseNotFoundError(exerciseId)` | detail, update, archive, restore | 404 |
| `ExerciseOwnershipError(exerciseId, currentUserId)` | writes on another user's custom exercise | 403 |
| `SystemExerciseImmutableError(exerciseId)` | any write on `owner_id IS NULL` | 403 |
| `CustomExerciseValidationError(issues: ValidationIssue[])` | create, update | 400 |
| `DuplicateExerciseNameError(scope)`, scope `'system'`, `'own'` or `'own_archived'` | create, update | 409 |
| `ExerciseTypeLockedError(exerciseId)` | update that changes `exerciseType` while `hasLoggedSets` | 409 |

### Entities

- `Exercise` (Drizzle row) — system (`ownerId = null`, immutable) or custom (`ownerId = profiles.id`). Aggregate root of this context.

### Value Objects

- `MuscleGroup`, `Equipment`, `ExerciseType` — closed enums above.
- `ExerciseFilter` — search text plus muscle and equipment sets.
- `ExerciseTypeMetrics` — which set metrics a type requires (ADR-016 §3).

### Invariants

- System exercises (`ownerId IS NULL`) are never written by clients. Only `seedExerciseLibrary()` writes them (ADR-017 §1).
- Exercises are never hard-deleted. There is no delete port method and no delete RLS policy (ADR-017 §5).
- Names: system names are unique by `lower(name)`; custom names are unique per owner by `lower(name)`, **archived rows included**; a custom name may not equal a system name (FR-EL-006). The DB enforces the first two, the use case the third.
- `secondaryMuscles` holds 0–3 distinct values, none equal to `muscleGroup`.
- `exerciseType` is immutable once `hasLoggedSets` is true (FR-EL-007).
- Every "add exercise" write path (picker, routine builder, copies) accepts only `canPick(...) === null`: system, or own and not archived. Archived exercises already referenced stay valid in history and routines (FR-EL-008).
- A family member's custom exercise is readable (detail, names in the feed) but never pickable (FR-EL-009).
- System `instructions` have 2–6 numbered steps in Spanish; names stay English (FR-EL-010/011).
- The 32 Phase 1 exercises keep their `id` and `name` (FR-EL-010).

### Ports

Abstract classes in `domain/` (ADR-007, ADR-011). Method names follow the code style (`findX`, `listX`, `create`, `update`).

- `ExerciseCatalogRepository` (`domain/exercise-catalog.repository.ts`) — reads: `listForUser`, `listArchivedForUser`, `search`, `findById`, `findByIds`, `findRecentIdsForUser`, `existsSystemName`, `findOwnByName`.
- `CustomExerciseRepository` (`domain/custom-exercise.repository.ts`) — writes: `create`, `update`, `archive`, `restore`; plus `hasLoggedSets`.
- `ExerciseCatalogPort` (`domain/exercise-catalog.port.ts`) — **public, read-only, cross-context**. Consumers: workout-tracking (9.1/9.2: add/replace validation, metric rules), routines (8.2: builder validation, copy filtering), progression (10.2: equipment and muscle for increments, [ADR-021 §4](../../decisions/021-progression-engine.md)), progress (11.2: muscle distribution). Exercise-library provides the adapter; consumers depend only on the abstract class and import the instance from `exercise-library.composition.ts`.

---

## Application

### Use Cases

Files: `src/lib/contexts/exercise-library/application/<verb-noun>.use-case.ts`.

| Use case | Purpose | Story | Status |
|---|---|---|---|
| `ListExercisesUseCase` | System + own non-archived, sorted, plus `recentIds` (FR-EL-001, FR-EL-004). `archived: true` returns own archived only ("Archivados", FR-EL-008) | 7.3 | planned |
| `GetRecentExercisesUseCase` | Up to 8 pickable exercises the user logged most recently (FR-EL-004) | 7.3 | planned |
| `GetExerciseDetailUseCase` | One exercise plus `isOwn`, `canEdit`, `isTypeLocked`, `ownerDisplayName` (FR-EL-003, FR-EL-009) | 7.3 | planned |
| `CreateCustomExerciseUseCase` | Validate, check uniqueness, insert with `ownerId = userId` (FR-EL-006) | 7.4 | planned |
| `UpdateCustomExerciseUseCase` | Owner-only edit with type lock (FR-EL-007) | 7.4 | planned |
| `ArchiveCustomExerciseUseCase` | Owner-only, idempotent `isArchived = true` (FR-EL-008) | 7.4 | planned |
| `RestoreCustomExerciseUseCase` | Owner-only, idempotent `isArchived = false` (FR-EL-008) | 7.4 | planned |
| `seedExerciseLibrary(db)` (seed function) | Idempotent system-catalog upsert from `db/seed-data/exercises.ts` (FR-EL-010) | 7.2 | planned |

### Orchestration

1. `ListExercisesUseCase.execute({ userId, archived = false })`:
   - `archived` → `catalog.listArchivedForUser(userId)` → `sortByName` → `{ exercises, recentIds: [] }`.
   - otherwise → `catalog.listForUser(userId)` and `getRecentExercises.execute({ userId })` in parallel → map to `ExerciseListItem` → `sortByName` → `{ exercises, recentIds }`.

2. `GetRecentExercisesUseCase.execute({ userId })`:
   - `catalog.findRecentIdsForUser(userId, ExerciseCatalogRules.RecentScanEntries)` → distinct ids ordered by latest completed set.
   - `catalog.findByIds(ids)` → keep `canPick(e, userId) === null` → first `RecentLimit` (8), order preserved.

3. `GetExerciseDetailUseCase.execute({ exerciseId, userId })`:
   - `catalog.findById(exerciseId)` → `ExerciseNotFoundError` if missing. Archived and family-owned exercises are returned (detail is read-all).
   - `isOwn = exercise.ownerId === userId`; `isTypeLocked = isOwn ? await customs.hasLoggedSets(exerciseId) : false`.
   - `ownerDisplayName` comes from the repository's join on `profiles` (no cross-context call).

4. `CreateCustomExerciseUseCase.execute({ userId, input })`:
   - Trim `name`, `instructions`, `videoUrl`; empty strings → `null`; dedupe `secondaryMuscles`.
   - `validateCustomExercise(input)` → `CustomExerciseValidationError` on issues.
   - `catalog.existsSystemName(name)` → `DuplicateExerciseNameError('system')` ("Ya existe en la biblioteca").
   - `catalog.findOwnByName(userId, name)` → `'own'` ("Ya tienes un ejercicio con ese nombre") or `'own_archived'` ("Ya tienes un ejercicio archivado con ese nombre. Restáuralo desde Archivados").
   - `customs.create({ ...input, ownerId: userId })`. A unique-index race maps to `DuplicateExerciseNameError('own')`.
   - Return the `Exercise` (the picker selects it, [pick-exercises flow](./flows/pick-exercises.flow.md)).

5. `UpdateCustomExerciseUseCase.execute({ userId, exerciseId, patch })`:
   - `catalog.findById` → `ExerciseNotFoundError` / `SystemExerciseImmutableError` / `ExerciseOwnershipError`.
   - Merge the patch onto the current values → validate → uniqueness checks (excluding itself) when `name` changes.
   - `patch.exerciseType` differs and `customs.hasLoggedSets(exerciseId)` → `ExerciseTypeLockedError`.
   - `customs.update(exerciseId, patch, userId)`.

6. `ArchiveCustomExerciseUseCase` / `RestoreCustomExerciseUseCase.execute({ userId, exerciseId })`: same guards as update → `customs.archive(...)` / `customs.restore(...)`. Archiving never touches routines or workouts.

7. `seedExerciseLibrary(db)` (`db/seed.ts`, story 7.2):
   - Source: `db/seed-data/exercises.ts`, 107 rows (`name`, `equipment`, `exerciseType`, `muscleGroup`, `secondaryMuscles`, `instructions`, optional `videoUrl`, `legacy`). `scripts/generate-exercise-seed.ts` renders the same data into `supabase/migrations/005_exercise_library_seed.sql`.
   - Per row, look up a system row by `lower(name)`: legacy (L) rows are **updated in place** (same `id`), new rows are inserted. A second run changes nothing.
   - Assertions (seed test): ≥ 100 rows; every `MuscleGroups` value except `UncoveredMuscleGroups` is a primary muscle of some row; cardio present; 2–6 instruction steps per row; all 32 Phase 1 names present with their IDs.

---

## Infrastructure

Per [ADR-007](../../decisions/007-repository-pattern.md), each port has an abstract class and two implementations. Per [ADR-011](../../decisions/011-implements-not-extends.md), concrete classes use `implements`.

### Abstract Classes (Contracts)

```ts
// src/lib/contexts/exercise-library/domain/exercise-catalog.repository.ts
export abstract class ExerciseCatalogRepository {
  /** System + own non-archived (FR-EL-001). Unsorted; the use case sorts. */
  abstract listForUser(userId: string): Promise<Exercise[]>;
  /** Own archived custom exercises ("Archivados"). */
  abstract listArchivedForUser(userId: string): Promise<Exercise[]>;
  /** listForUser + matchesExerciseFilter in memory (~110 rows): same semantics on both backends. */
  abstract search(userId: string, filter: ExerciseFilter): Promise<Exercise[]>;
  /** Any owner, archived included (read-all). Joins the owner's display name. */
  abstract findById(id: string): Promise<(Exercise & { ownerDisplayName: string | null }) | undefined>;
  /** Missing ids are omitted; order not guaranteed. */
  abstract findByIds(ids: readonly string[]): Promise<Exercise[]>;
  /** Distinct exercise ids from the user's latest completed sets, newest first. */
  abstract findRecentIdsForUser(userId: string, scanEntries: number): Promise<string[]>;
  abstract existsSystemName(name: string): Promise<boolean>;
  /** Own custom exercise whose lower(name) matches, archived included. */
  abstract findOwnByName(ownerId: string, name: string): Promise<Exercise | undefined>;
}

// src/lib/contexts/exercise-library/domain/custom-exercise.repository.ts
export abstract class CustomExerciseRepository {
  abstract create(input: CustomExerciseInput & { ownerId: string }): Promise<Exercise>;
  /** Throws ExerciseOwnershipError / SystemExerciseImmutableError (write-own, ADR-004). */
  abstract update(id: string, patch: CustomExercisePatch, currentUserId: string): Promise<Exercise>;
  abstract archive(id: string, currentUserId: string): Promise<Exercise>;
  abstract restore(id: string, currentUserId: string): Promise<Exercise>;
  /** True when any workout_exercises or workout_entries row references the exercise. */
  abstract hasLoggedSets(exerciseId: string): Promise<boolean>;
}

// src/lib/contexts/exercise-library/domain/exercise-catalog.port.ts
/** Public read-only port. Other contexts depend on this class only. */
export abstract class ExerciseCatalogPort {
  /** Any exercise, archived and family-owned included. */
  abstract findById(id: string): Promise<CatalogExercise | undefined>;
  /** Missing ids are omitted. */
  abstract findByIds(ids: readonly string[]): Promise<CatalogExercise[]>;
  /** Only exercises the user may ADD: system, or own and not archived (canPick). Missing id = not usable. */
  abstract findUsableByIds(ids: readonly string[], userId: string): Promise<CatalogExercise[]>;
}
```

`ExerciseCatalogAdapter implements ExerciseCatalogPort` (`application/exercise-catalog.adapter.ts`) wraps `ExerciseCatalogRepository` and `canPick`. It has no backend-specific code, so one adapter serves both backends. Consumers may also import `ExerciseTypeMetricRules` and the label maps from `exercise-library.constants.ts` (pure, no I/O).

### SQLite (`infrastructure/sqlite/`)

- `SqliteExerciseCatalogRepository`, `SqliteCustomExerciseRepository` take the Drizzle `Db`.
- `listForUser`: `WHERE is_archived = 0 AND (owner_id IS NULL OR owner_id = ?)`.
- `findRecentIdsForUser`: `workout_entries` joined with `workouts` (`user_id = ?`, `completed = 1`), ordered by `COALESCE(completed_at, created_at) DESC`, `LIMIT scanEntries`, deduplicated in code (same algorithm as Supabase).
- Write-own guards live in the repository (`ownerId === currentUserId`, `ownerId !== null`), as SQLite has no RLS.
- `UNIQUE constraint failed` → `DuplicateExerciseNameError('own')`.

### Supabase (`infrastructure/supabase/`)

- `SupabaseExerciseCatalogRepository`, `SupabaseCustomExerciseRepository` take the Supabase client.
- `listForUser`: `.from('exercises').select(...).eq('is_archived', false).or('owner_id.is.null,owner_id.eq.' + userId)`.
- `findRecentIdsForUser`: `.from('workout_entries').select('exercise_id, completed_at, workouts!inner(user_id)').eq('workouts.user_id', userId).eq('completed', true).order('completed_at', { ascending: false }).limit(scanEntries)`, deduplicated in code. Decision: no new SQL function, so migration 005 stays data-only.
- RLS (migration 004): `exercises_select_read_all`, `exercises_insert_own`, `exercises_update_own` (`owner_id = auth.uid()`), no delete policy. The repository still checks ownership first, so callers get typed errors instead of zero-row updates. Postgres `23505` → `DuplicateExerciseNameError('own')`.

### Wiring (Per-Context Composition)

Per [ADR-010](../../decisions/010-per-context-composition.md), with the same `resolveStorageBackend()` / `build*()` pattern as `workout-tracking.composition.ts`.

```ts
// src/lib/contexts/exercise-library/exercise-library.composition.ts
const backend = resolveStorageBackend();
const catalogRepository = buildExerciseCatalogRepository(backend);        // Sqlite… or Supabase…
const customExerciseRepository = buildCustomExerciseRepository(backend);

export const exerciseCatalogPort: ExerciseCatalogPort = new ExerciseCatalogAdapter(catalogRepository);

export const getRecentExercisesUseCase = new GetRecentExercisesUseCase(catalogRepository);
export const listExercisesUseCase = new ListExercisesUseCase(catalogRepository, getRecentExercisesUseCase);
export const getExerciseDetailUseCase = new GetExerciseDetailUseCase(catalogRepository, customExerciseRepository);
export const createCustomExerciseUseCase = new CreateCustomExerciseUseCase(catalogRepository, customExerciseRepository);
export const updateCustomExerciseUseCase = new UpdateCustomExerciseUseCase(catalogRepository, customExerciseRepository);
export const archiveCustomExerciseUseCase = new ArchiveCustomExerciseUseCase(catalogRepository, customExerciseRepository);
export const restoreCustomExerciseUseCase = new RestoreCustomExerciseUseCase(catalogRepository, customExerciseRepository);
```

Other compositions (`workout-tracking`, `routines`, `progression`, `progress`) import `exerciseCatalogPort` from here and inject it.

---

## UI

### Components

Specs belong in [components.md → Exercise Library](../../components.md#exercise-library). Files in `src/components/`, kebab-case, React `.tsx` when interactive ([ADR-015](../../decisions/015-live-workout-react-island.md)).

| Component | File | Notes |
|---|---|---|
| `ExerciseListItem` | `exercise-list-item.tsx` | Name, `MuscleGroupLabels[muscleGroup]`, `EquipmentLabels[equipment]`, "Personalizado" tag; optional order badge (picker) |
| `ExerciseFilters` | `exercise-filters.tsx` | Search input (150 ms debounce), "Músculo" and "Equipo" multi-select chips, *Limpiar* |
| `ExercisePicker` | `exercise-picker.tsx` | Bottom sheet (< 768 px) or modal. Props: `mode` (`'add'` or `'replace'`), `maxSelectable`, `onConfirm(ids: string[])`, `onClose()` |
| `CustomExerciseForm` | `custom-exercise-form.tsx` | Create/edit (FR-EL-006/007). Embedded in the picker and on `/exercises/new`, `/exercises/[id]/edit` |
| `ExerciseInstructions` | `exercise-instructions.astro` | "Cómo hacerlo" tab: muscles, equipment, type label, numbered steps, *Ver video* (new tab, `rel="noopener noreferrer"`) |

Client helper `src/lib/client/exercise-catalog.ts`: `loadExerciseCatalog()` fetches `GET /api/exercises` once per page session (module-level promise); `addToCatalogCache(item)` appends an exercise created inline. The service worker adds stale-while-revalidate on top (ADR-025).

### Interactive components (React islands)

- `exercise-library-list.tsx` — `/exercises`: Recientes, alphabetical list, filters; client-side filtering with `matchesExerciseFilter` (NFR-EL-01: < 50 ms per keystroke).
- `exercise-picker.tsx` — mounted inside the live workout island ([workout-tracking](../workout-tracking/readme.md), story 9.1) and the routine builder island ([routines](../routines/readme.md), story 8.2). Never imports repositories.
- `custom-exercise-form.tsx` — calls `POST /api/exercises` / `PATCH /api/exercises/[id]`.

### Pages

| Route | Rendering | Content | Story |
|---|---|---|---|
| `/exercises` | SSR shell + `exercise-library-list` island | FR-EL-001/002/004. *+ Crear ejercicio* → `/exercises/new`. *Archivados* → `/exercises?archived=1` (own archived, *Restaurar*) | 7.3, 7.4 |
| `/exercises/new` | SSR + `custom-exercise-form` | FR-EL-006. `?name=` prefills from an empty search | 7.4 |
| `/exercises/[id]` | SSR | Header (name, muscle, equipment, "Personalizado"), tabs via `?tab=` (`como`, `historial`, `graficas`, `records`). Owner actions *Editar*, *Archivar* / *Restaurar* | 7.3 (+ tabs below) |
| `/exercises/[id]/edit` | SSR + `custom-exercise-form` | Owner only (403 otherwise). Type select disabled with a hint when `isTypeLocked` | 7.4 |

**Detail tab composition.** `/exercises/[id].astro` calls `getExerciseDetailUseCase` from this composition and, for the other tabs, use cases exported by `progress.composition.ts` (named in the [progress context](../progress/readme.md)), passing `exerciseId` and the **viewer's** `userId`. The tabs always show the viewer's own data, also on a family member's custom exercise.

| Tab | Data owner | Requirement | Story |
|---|---|---|---|
| Cómo hacerlo | exercise-library | FR-EL-003 | 7.3 |
| Récords | progress (records engine) | [FR-PR-011](../../../prd/features/progress.md#fr-pr-011) | 10.1 |
| Gráficas | progress | [FR-PR-012](../../../prd/features/progress.md#fr-pr-012) | 11.2 |
| Historial | progress | [FR-PR-013](../../../prd/features/progress.md#fr-pr-013) | 11.2 |

Decision: a tab whose story has not shipped is not rendered (no "Próximamente" placeholder). Exercise-library never imports progress code; only the page composes both contexts.

### API endpoints

All require a session (401 otherwise). Errors are JSON `{ error: { code, message, issues? } }` so islands can map them to fields.

| Method | Path | Use case | Notes |
|---|---|---|---|
| GET | `/api/exercises` | `ListExercisesUseCase` | Full `ExerciseCatalogView` for client-side filtering. `?archived=1` → own archived. Headers: `Cache-Control: private, no-cache`, `Vary: Cookie`, weak `ETag` (SHA-1 of the body); matching `If-None-Match` → 304. The service worker applies stale-while-revalidate (ADR-025) |
| GET | `/api/exercises/[id]` | `GetExerciseDetailUseCase` | 404 on unknown id. Used by the edit form |
| POST | `/api/exercises` | `CreateCustomExerciseUseCase` | 201 `{ exercise }`; 400 `validation` with `issues`; 409 `duplicate_name` with `scope` |
| PATCH | `/api/exercises/[id]` | `UpdateCustomExerciseUseCase` | 200; 403 not owner or system; 404; 409 `duplicate_name` or `type_locked` |
| POST | `/api/exercises/[id]/archive` | `ArchiveCustomExerciseUseCase` | 200, idempotent; 403; 404 |
| POST | `/api/exercises/[id]/restore` | `RestoreCustomExerciseUseCase` | 200, idempotent; 403; 404 |

Decision: `recentIds` travel inside `GET /api/exercises`, so one request opens the picker (NFR-EL-01). Recientes may be one revalidation stale, which is acceptable.

---

## Testing

Per [ADR-009](../../decisions/009-object-mothers.md): real SQLite, Object Mothers, no mocks. Files in `tests/exercise-library/`; harness `tests/exercise-library/test-db.ts` (the `tests/workout-tracking/test-db.ts` pattern with the 004 DDL).

| What | File | Kind |
|---|---|---|
| `normalizeSearchText`, `matchesExerciseFilter`, `sortByName` | `exercise-filter.test.ts` | Table-driven: accents and case (`"press"` matches `"Prèss"`), AND across / OR within groups, empty filter |
| `validateCustomExercise` | `custom-exercise.validation.test.ts` | Table-driven, one row per FR-EL-006 rule |
| `canPick` | `exercise-pickability.test.ts` | system / own / own archived / sibling's / missing |
| Constants vs schema enums, labels complete | `exercise-library.constants.test.ts` | Every enum value has a label; arrays equal the Drizzle enums |
| Repositories | `sqlite-exercise-catalog.repository.test.ts`, `sqlite-custom-exercise.repository.test.ts` | `listForUser` excludes sibling's and archived rows; recent ordering and dedupe; ownership guards; unique index is case-insensitive and counts archived rows |
| Use cases | `list-exercises.use-case.test.ts`, `get-exercise-detail.use-case.test.ts`, `create-custom-exercise.use-case.test.ts`, `update-custom-exercise.use-case.test.ts`, `archive-custom-exercise.use-case.test.ts` | Happy path plus every domain error |
| Seed | `seed-exercise-library.test.ts` | FR-EL-010 assertions; legacy IDs unchanged; second run is a no-op |
| Phase 1 regression | `phase-1-fixture.test.ts` (fixture `tests/fixtures/phase-1.db`, story 7.1) | After 004 + 005, Phase 1 exercise IDs/names and history totals are unchanged |
| RLS | `tests/supabase/rls-exercises.integration.test.ts` | As a **non-owner**: cannot update or archive a sibling's custom exercise, cannot insert with another `owner_id`, cannot update a system row, cannot delete any row; can read all |

Object Mother (`tests/exercise-library/mothers/exercise.mother.ts`):

```ts
export class ExerciseMother {
  static system(overrides: Partial<NewExercise> = {}): NewExercise {
    return {
      id: crypto.randomUUID(),
      name: `System ${faker.string.alpha(8)}`,
      muscleGroup: 'chest',
      secondaryMuscles: ['triceps'],
      equipment: 'barbell',
      exerciseType: 'weight_reps',
      instructions: '1. Paso uno\n2. Paso dos',
      ownerId: null,
      isArchived: false,
      ...overrides,
    };
  }
  static custom(ownerId: string, overrides: Partial<NewExercise> = {}): NewExercise {
    return this.system({ name: `Custom ${faker.string.alpha(8)}`, instructions: null, ownerId, ...overrides });
  }
  static archived(ownerId: string, overrides: Partial<NewExercise> = {}): NewExercise {
    return this.custom(ownerId, { isArchived: true, ...overrides });
  }
}
```

Example skeleton:

```ts
// tests/exercise-library/create-custom-exercise.use-case.test.ts
describe('CreateCustomExerciseUseCase', () => {
  let handle: TestDbHandle;
  let useCase: CreateCustomExerciseUseCase;

  beforeEach(() => {
    handle = createTestDb();
    useCase = new CreateCustomExerciseUseCase(
      new SqliteExerciseCatalogRepository(handle.db),
      new SqliteCustomExerciseRepository(handle.db),
    );
  });
  afterEach(() => handle.close());

  it('rejects a name equal to a system exercise, ignoring case and spaces', async () => {
    await handle.db.insert(exercises).values(ExerciseMother.system({ name: 'Bench Press' }));
    const userId = await insertProfile(handle.db);

    await expect(
      useCase.execute({ userId, input: { ...CustomExerciseInputMother.valid(), name: '  bench press ' } }),
    ).rejects.toBeInstanceOf(DuplicateExerciseNameError);
  });
});
```

---

## Flows

- [browse-exercises.flow.md](./flows/browse-exercises.flow.md) — `/exercises`, search, filters, detail tabs.
- [pick-exercises.flow.md](./flows/pick-exercises.flow.md) — picker in the live workout and the routine builder: multi-select order, replace mode, inline create.
- [create-custom-exercise.flow.md](./flows/create-custom-exercise.flow.md) — create, edit, archive, restore.
