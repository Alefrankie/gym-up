# Programs & Routines Context

Parent: [../readme.md](../readme.md) · PRD: [../../../prd/features/routines.md](../../../prd/features/routines.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Phase | 2 |
| Last edited | 2026-10-01 |

Decisions: [ADR-018](../../decisions/018-user-owned-programs.md) (user-owned programs, supersedes [ADR-003](../../decisions/003-routines-seed-data.md)), [ADR-019](../../decisions/019-rotation-scheduling-and-onboarding.md) (rotation, onboarding, recommendation), [ADR-025](../../decisions/025-offline-live-workout.md) (offline next routine). Schema: [006 — Programs](../../database-schema.md#006--programs-adr-018-adr-019), [Program Templates Seed](../../database-schema.md#program-templates-seed). Stories: [8.1](../../../stories/phase-2/round-8/story-8.1.md) (schema, templates, user migration), [8.2](../../../stories/phase-2/round-8/story-8.2.md) (builder), [8.3](../../../stories/phase-2/round-8/story-8.3.md) (rotation, dashboard), [8.4](../../../stories/phase-2/round-8/story-8.4.md) (onboarding, templates browser), [9.3](../../../stories/phase-2/round-9/story-9.3.md) (save workout as routine).

## Purpose

Owns user programs and routines (Hevy folders and routines), the 7 seeded templates, the rotation that always answers "what is my next workout" (Gravl), and the onboarding questionnaire with its deterministic recommendation. It supersedes the Phase 1 fixed `hombre` / `mujer` routines: those become two templates.

It does **not** own workouts. Workout-tracking starts a workout from a routine through `RoutinePlanPort`; routines reads workout results only through `RotationQuery` (its own read model) and `WorkoutSnapshotPort`.

### Vocabulary ([ADR-018 §1](../../decisions/018-user-owned-programs.md))

| Table | Drizzle export (`@db/schema`) | Domain term (this context) | Hevy | UI (es) |
|---|---|---|---|---|
| `routines` | `routines`, type `Routine` | **Program** | Folder | "Programa" |
| `routine_days` | `routineDays`, type `RoutineDay` | **Routine** | Routine | "Rutina" |
| `routine_exercises` | `routineExercises`, type `RoutineExercise` | **Routine exercise** | Routine exercise | "Ejercicio" |

Rule: inside this context, the Drizzle `Routine` type is always imported with an alias (`Routine as ProgramRow`), because the domain word "Routine" means a `routine_days` row.

---

## Domain

File naming: **kebab-case**. Domain files in `src/lib/contexts/routines/domain/`.

### Schema (`db/schema.ts`, story 8.1)

Columns added by migration 006 ([schema](../../database-schema.md#006--programs-adr-018-adr-019)). Excerpt of the new fields only:

```ts
// db/schema.ts (excerpt) — 0006_programs.sql / supabase 006_programs.sql
export const routines = sqliteTable('routines', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type', { enum: ['hombre', 'mujer'] }),                 // nullable since 006: template tag only
  ownerId: text('owner_id').references(() => profiles.id, { onDelete: 'cascade' }), // NULL = template
  slug: text('slug'),                                                // templates only, unique when set
  sourceTemplateId: text('source_template_id').references((): AnySQLiteColumn => routines.id, { onDelete: 'set null' }),
  description: text('description'),
  isTemplate: integer('is_template', { mode: 'boolean' }).notNull().default(false),
  level: text('level', { enum: ['beginner', 'intermediate', 'advanced'] }),
  goal: text('goal', { enum: ['strength', 'hypertrophy', 'general'] }),
  daysPerWeek: integer('days_per_week'),
  equipmentProfile: text('equipment_profile', { enum: ['full_gym', 'dumbbells', 'bodyweight'] }),
  focus: text('focus', { enum: ['balanced', 'glutes_legs', 'upper_body'] }),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  rotationAnchorAt: integer('rotation_anchor_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex('uq_routines_slug').on(t.slug).where(sql`slug IS NOT NULL`),
  index('idx_routines_owner').on(t.ownerId),
]);

// routineDays: + notes text, + isArchived boolean (default false); dayNumber = rotation position 1..14
// routineExercises: + targetRepsMin, targetRepsMax (int, nullable), + warmupSets (int, default 0),
//   + restSeconds (int, NULL = user default), + supersetGroup (int), + targetRpe (real), + notes (text).
//   targetReps (legacy, NOT NULL) is written as targetRepsMax (or 10 when the range is hidden).
// profiles: + activeProgramId (FK routines.id, set null), + trainingGoal, experienceLevel,
//   daysPerWeek, equipmentProfile, focus, onboardingCompletedAt (timestamp).
```

### `routines.types.ts`

```ts
// src/lib/contexts/routines/domain/routines.types.ts
import type {
  Routine as ProgramRow,
  RoutineDay as RoutineRow,
  RoutineExercise as RoutineExerciseRow,
} from '@db/schema';
import type { CatalogExercise } from '@/lib/contexts/exercise-library/domain/exercise-library.types';
import type { TrainingGoal, ExperienceLevel, EquipmentProfile, ProgramFocus, TrainingDays } from './routines.constants';

export type Program = ProgramRow;              // routines row (template when ownerId === null)
export type Routine = RoutineRow;              // routine_days row
export type RoutineExercise = RoutineExerciseRow;

export interface RoutineExerciseWithExercise extends RoutineExercise {
  exercise: CatalogExercise;                   // joined from exercises (own read model)
}

export interface RoutineWithExercises {
  routine: Routine;
  exercises: RoutineExerciseWithExercise[];    // ordered by exerciseOrder
}

export interface ProgramSummary {
  program: Program;
  isActive: boolean;
  routines: Array<Pick<Routine, 'id' | 'dayName' | 'dayNumber' | 'isArchived'> & { exerciseCount: number }>;
}

export interface ProgramWithRoutines {
  program: Program;
  routines: RoutineWithExercises[];            // ordered by dayNumber
}

/** Template metadata (ADR-018 §3). Only rows with isTemplate = true. */
export interface TemplateMeta {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  level: ExperienceLevel;
  goal: TrainingGoal;
  daysPerWeek: number;
  equipmentProfile: EquipmentProfile;
  focus: ProgramFocus;
  routineCount: number;
}

/** One builder row (FR-RT-008). */
export interface RoutineExerciseInput {
  exerciseId: string;
  targetSets: number;
  targetRepsMin: number | null;                // seconds for duration types; null for distance types
  targetRepsMax: number | null;
  warmupSets: number;
  restSeconds: number | null;                  // null = "Por defecto" (profiles.default_rest_seconds)
  supersetGroup: number | null;
  targetRpe: number | null;
  notes: string | null;
}

export interface SaveRoutineInput {
  routineId?: string;                          // absent = create
  programId: string;
  name: string;
  notes: string | null;
  exercises: RoutineExerciseInput[];           // array order = exerciseOrder 1..n
}

/** ADR-019 §2. focus defaults to 'balanced' when skipped. */
export interface OnboardingAnswers {
  goal: TrainingGoal;
  experience: ExperienceLevel;
  daysPerWeek: TrainingDays;
  equipment: EquipmentProfile;
  focus: ProgramFocus;
}

export type MatchedCriterion = 'days' | 'equipment' | 'level' | 'goal' | 'focus';

export interface Recommendation {
  template: TemplateMeta;
  score: number;
  matched: MatchedCriterion[];
  reason: string;                              // "3 días · mancuernas · principiante" (FR-RT-016)
}

export interface ProgramSettings {
  activeProgramId: string | null;
  onboarding: OnboardingAnswers | null;        // null until answered
  onboardingCompletedAt: Date | null;
  defaultRestSeconds: number;                  // profiles.default_rest_seconds (004)
  timezone: string;                            // profiles.timezone (004)
}

/** Output of GetNextWorkoutUseCase (FR-RT-010..014). */
export type NextWorkoutView =
  | { kind: 'no_program' }                                   // FR-RT-014
  | { kind: 'empty_program'; program: Program }              // active program has no active routines
  | {
      kind: 'next';
      program: Program;
      next: RoutineCard;
      others: RoutineCard[];                                 // every other active routine, rotation order
    };

export interface RoutineCard {
  routine: Routine;
  exercises: Array<{ name: string; exerciseType: string; targetSets: number; targetRepsMin: number | null; targetRepsMax: number | null }>;
  estimatedMinutes: number;                                  // FR-RT-011
  muscleGroups: string[];                                    // primary muscles, for recovery hints (10.4)
  lastDoneAt: Date | null;
  daysSinceLastDone: number | null;                          // "hecha hace N días" (FR-RT-012)
}
```

### `routines.constants.ts`

```ts
// src/lib/contexts/routines/domain/routines.constants.ts

/** ADR-018 §5 + FR-RT-002/007/008 */
export const ProgramRules = {
  MaxProgramsPerUser: 20,          // owned programs, archived included
  MaxRoutinesPerProgram: 14,       // archived included (day_number CHECK 1..14)
  MaxExercisesPerRoutine: 30,      // = WorkoutSessionRules.MaxExercises (ADR-016)
  MinTargetSets: 1,
  MaxTargetSets: 20,
  MinReps: 1,
  MaxReps: 100,                    // DB CHECK routine_exercises_reps_range
  MinRepRangeWidth: 2,             // FR-RT-018 "widened to at least 2 apart"
  MaxWarmupSets: 5,
  MinRestSeconds: 0,
  MaxRestSeconds: 600,
  RestStepSeconds: 15,
  MinTargetRpe: 6,
  MaxTargetRpe: 10,
  ProgramNameMaxLength: 60,
  ProgramDescriptionMaxLength: 500,
  RoutineNameMaxLength: 60,
  RoutineNotesMaxLength: 500,
  ExerciseNoteMaxLength: 300,
} as const;

/** FR-RT-008 defaults for a row added in the builder. */
export const RoutineExerciseDefaults = {
  TargetSets: 3,
  TargetRepsMin: 8,
  TargetRepsMax: 12,
  DurationSecondsMin: 30,          // Decision: duration types start at 30–60 s (Hevy uses a time target)
  DurationSecondsMax: 60,
  WarmupSets: 0,
  RestSeconds: null,               // "Por defecto"
  LegacyTargetReps: 10,            // routine_exercises.target_reps when the range is hidden
} as const;

/** Default names used by copy / save-as-routine destinations. */
export const ProgramNames = {
  CopiedRoutines: 'Copiadas',      // FR-RT-006
  SavedRoutines: 'Mis rutinas',    // FR-RT-018 default for "new program". Decision: simplest default
  DuplicateSuffix: ' (copia)',     // FR-RT-009 duplicate. Decision
} as const;

/** FR-RT-011: Σ sets × (40 s + rest) + 5 min, rounded to 5 min. */
export const DurationEstimateRules = {
  SecondsPerSet: 40,
  BaseMinutes: 5,
  RoundToMinutes: 5,
} as const;

export const TrainingGoals = { Strength: 'strength', Hypertrophy: 'hypertrophy', General: 'general' } as const;
export type TrainingGoal = (typeof TrainingGoals)[keyof typeof TrainingGoals];

export const ExperienceLevels = { Beginner: 'beginner', Intermediate: 'intermediate', Advanced: 'advanced' } as const;
export type ExperienceLevel = (typeof ExperienceLevels)[keyof typeof ExperienceLevels];

export const EquipmentProfiles = { FullGym: 'full_gym', Dumbbells: 'dumbbells', Bodyweight: 'bodyweight' } as const;
export type EquipmentProfile = (typeof EquipmentProfiles)[keyof typeof EquipmentProfiles];

export const ProgramFocuses = { Balanced: 'balanced', GlutesLegs: 'glutes_legs', UpperBody: 'upper_body' } as const;
export type ProgramFocus = (typeof ProgramFocuses)[keyof typeof ProgramFocuses];

export const TrainingDaysOptions = [2, 3, 4, 5, 6] as const;
export type TrainingDays = (typeof TrainingDaysOptions)[number];

/** ADR-019 §2 questionnaire, in step order. Labels are UI copy. */
export const OnboardingOptions = {
  goal: { strength: 'Fuerza', hypertrophy: 'Ganar músculo', general: 'Salud y forma general' },
  experience: {
    beginner: 'Principiante (menos de 6 meses)',
    intermediate: 'Intermedio (6 meses – 2 años)',
    advanced: 'Avanzado (más de 2 años)',
  },
  daysPerWeek: { 2: '2 días', 3: '3 días', 4: '4 días', 5: '5 días', 6: '6 días' },
  equipment: { full_gym: 'Gimnasio completo', dumbbells: 'Mancuernas', bodyweight: 'Peso corporal' },
  focus: { balanced: 'Equilibrado', glutes_legs: 'Glúteos y piernas', upper_body: 'Tren superior' },
} as const;

/** Short lowercase labels for the reason sentence (FR-RT-016). */
export const ReasonLabels = {
  equipment: { full_gym: 'gimnasio completo', dumbbells: 'mancuernas', bodyweight: 'peso corporal' },
  level: { beginner: 'principiante', intermediate: 'intermedio', advanced: 'avanzado' },
  goal: { strength: 'fuerza', hypertrophy: 'hipertrofia', general: 'salud general' },
  focus: { balanced: 'equilibrado', glutes_legs: 'glúteos y piernas', upper_body: 'tren superior' },
  days: (n: number) => `${n} días`,
  fallback: 'lo más parecido a lo que buscas',
} as const;

/** ADR-019 §3 */
export const RecommendationWeights = {
  EquipmentMatch: 40,
  DaysBase: 30,
  DaysPenaltyPerDay: 10,           // not clamped: the days term may go negative (ADR literal)
  LevelMatch: 20,
  GoalMatch: 15,
  FocusMatch: 25,                  // only when answer.focus !== 'balanced'
  MinScoredDays: 3,                // answer.days === 2 is scored as 3
  Alternatives: 2,
} as const;

/** ADR-019 §3 filter: which template equipment profiles each answer may use. */
export const EquipmentEligibility: Record<EquipmentProfile, readonly EquipmentProfile[]> = {
  full_gym: ['full_gym', 'dumbbells', 'bodyweight'],
  dumbbells: ['dumbbells', 'bodyweight'],
  bodyweight: ['bodyweight'],
};

/** Tie-break order = seed order (database-schema.md → Program Templates Seed). */
export const TemplateSeedOrder = [
  'male-5-day-split', 'female-glute-focus-5-day', 'full-body-beginner-3-day', 'upper-lower-4-day',
  'push-pull-legs-6-day', 'dumbbell-full-body-3-day', 'bodyweight-home-3-day',
] as const;

/** ADR-018 §4: Phase 1 routine_type → template adopted by the 006 migration. */
export const LegacyRoutineTemplate = { hombre: 'male-5-day-split', mujer: 'female-glute-focus-5-day' } as const;
```

### Pure domain functions

`scoreTemplate` implements ADR-019 §3 exactly; `recommendPrograms` ranks with it.

```ts
// src/lib/contexts/routines/domain/recommendation.ts
export function scoreTemplate(t: TemplateMeta, a: OnboardingAnswers): { score: number; matched: MatchedCriterion[] } | null {
  if (!EquipmentEligibility[a.equipment].includes(t.equipmentProfile)) return null; // filter
  const W = RecommendationWeights;
  const matched: MatchedCriterion[] = [];
  let score = 0;
  if (t.equipmentProfile === a.equipment) { score += W.EquipmentMatch; matched.push('equipment'); }
  const days = Math.max(a.daysPerWeek, W.MinScoredDays);
  score += W.DaysBase - W.DaysPenaltyPerDay * Math.abs(t.daysPerWeek - days);
  if (t.daysPerWeek === a.daysPerWeek) matched.push('days');
  if (t.level === a.experience) { score += W.LevelMatch; matched.push('level'); }
  if (t.goal === a.goal) { score += W.GoalMatch; matched.push('goal'); }
  if (a.focus !== 'balanced' && t.focus === a.focus) { score += W.FocusMatch; matched.push('focus'); }
  return { score, matched };
}

/** Sorted by score DESC, then TemplateSeedOrder. Returns [recommended, ...alternatives]. */
export function recommendPrograms(templates: TemplateMeta[], a: OnboardingAnswers): Recommendation[];
/** Joins ReasonLabels for matched criteria in the order days · equipment · level · goal · focus. */
export function buildReason(t: TemplateMeta, matched: MatchedCriterion[]): string;
```

| File | Export | Rule |
|---|---|---|
| `rotation.ts` | `computeNextRoutine(routines, lastDayNumber)` | ADR-019 §1 over **non-archived** routines ordered by `dayNumber`: first with `dayNumber > lastDayNumber`, else the first; `lastDayNumber` undefined → the first |
| `rotation.ts` | `daysSince(lastDoneAt, now, timezone)` | Calendar days between the two dates in `profiles.timezone`; 0 = "hoy", 1 = "ayer" |
| `duration-estimate.ts` | `estimateRoutineMinutes(exercises, defaultRestSeconds)` | FR-RT-011: `Σ (targetSets + warmupSets) × (40 + (restSeconds ?? defaultRestSeconds))` s, `/ 60 + 5`, rounded to the nearest 5 min, minimum 5. Decision: warm-up sets count as performed sets |
| `routine.validation.ts` | `validateProgramInput`, `validateRoutineInput(input)` | Lengths and limits from `ProgramRules`; each row: sets 1–20, `1 ≤ min ≤ max ≤ 100` (null pair allowed only for distance types), warm-up 0–5, rest null or 0–600 in 15 s steps, RPE null or 6–10, note ≤ 300. Superset groups must be contiguous rows; they are renumbered densely 1..n |
| `routine-from-workout.ts` | `deriveRoutineFromWorkout(snapshot)` | FR-RT-018, see orchestration 18 |

### `routines.errors.ts`

| Error | When | HTTP |
|---|---|---|
| `ProgramNotFoundError(id)` / `RoutineNotFoundError(id)` / `TemplateNotFoundError(slugOrId)` | unknown id or slug | 404 |
| `ProgramOwnershipError(programId, currentUserId)` | write on a program the user does not own | 403 |
| `TemplateImmutableError(programId)` | write on `ownerId IS NULL` | 403 |
| `ProgramLimitReachedError(limit)` | 21st program (create, adopt, copy, save-as new) | 409 |
| `RoutineLimitReachedError(limit)` | 15th routine in a program | 409 |
| `ProgramInUseError(programId)` / `RoutineInUseError(routineId)` | delete while `hasWorkoutReferences` (UI offers *Archivar*) | 409 |
| `ActiveProgramError(programId)` | archive or delete the active program | 409 |
| `ProgramArchivedError(programId)` | activate, or add routines to, an archived program | 409 |
| `RoutineValidationError(issues)` / `ProgramValidationError(issues)` | field rules | 400 |
| `ExerciseNotPickableError(exerciseId)` | new routine exercise not returned by `findUsableByIds` | 400 |
| `WorkoutNotSavableError(workoutId, reason)` | save-as-routine on a non-completed, foreign, or empty workout | 400 / 403 |

### Entities

- `Program` — aggregate root (`routines` row). Template (`ownerId = null`, `isTemplate = true`, has `slug`) or user program (`ownerId = me`).
- `Routine` — `routine_days` row inside a program; `dayNumber` is its rotation position.
- `RoutineExercise` — `routine_exercises` row; targets for one exercise slot.

### Value Objects

- `OnboardingAnswers`, `Recommendation`, `TemplateMeta`.
- `RepRange` — `[targetRepsMin, targetRepsMax]`; reps for rep types, seconds for duration types, `null` for distance types.
- `NextWorkoutView` — rotation result for the dashboard.

### Invariants

- Templates (`ownerId IS NULL`) are immutable for clients; only the seed (`seedProgramTemplates()`, migration 006) writes them (ADR-018 §2).
- Programs are read-all (siblings see and copy them) and write-own (ADR-004, RLS `routines_*_own`, `routine_days_write_own`, `routine_exercises_write_own`).
- Adopting or copying is a **deep copy**; later edits never touch the source. `sourceTemplateId` is set only when the source is a template.
- At most one active program: `profiles.activeProgramId`. The active program cannot be archived or deleted. Only owned, non-archived programs can be active.
- A program or routine is deletable only when `hasWorkoutReferences` is false; otherwise it is archived (FR-RT-003, FR-RT-009).
- `dayNumber` is dense 1..n per program: non-archived routines first in rotation order, archived ones after.
- `exerciseOrder` is dense 1..n per routine; `targetReps` (legacy) = `targetRepsMax`.
- Only pickable exercises may be **added** to a routine (`ExerciseCatalogPort.findUsableByIds`). Rows already present keep working when their exercise is later archived (FR-EL-008).
- The rotation never depends on the weekday (ADR-019 §1). Changing the active program or reordering routines restarts it (FR-RT-013).
- Phase 1 workouts keep pointing at the template `routine_days`; history is immutable.

### Ports

- `ProgramRepository` (`domain/program.repository.ts`) — aggregate persistence: programs, routines and routine exercises, templates, deep copies, delete guard.
- `RotationQuery` (`domain/rotation.query.ts`) — read model over `workouts` for the rotation and "hecha hace N días".
- `ProfileProgramSettings` (`domain/profile-program-settings.ts`) — `profiles` columns this context owns: `active_program_id`, onboarding answers; reads `default_rest_seconds` and `timezone`.
- `RoutinePlanPort` (`domain/routine-plan.port.ts`) — **provided** to workout-tracking (and progression for rep ranges, [ADR-021](../../decisions/021-progression-engine.md)).
- `RoutineCopyPort` (`domain/routine-copy.port.ts`) — **provided** to [social](../social/readme.md) for *Guardar rutina* on a sibling's workout (FR-SO-009). It has two methods:
  - `listTargetPrograms(userId): Promise<{ id: string; name: string; isActive: boolean }[]>`;
  - `copyRoutine({ userId, sourceRoutineId, targetProgramId | null }): Promise<{ routineId: string; programId: string }>`. A `null` target creates the program "Copiadas".

  `RoutineCopyAdapter` (`application/routine-copy.adapter.ts`) delegates to `ListProgramsUseCase` and `CopyRoutineUseCase` (Supabase RPC `copy_routine`).
- Consumed: `ExerciseCatalogPort` from [exercise-library](../exercise-library/readme.md); `WorkoutSnapshotPort` from [workout-tracking](../workout-tracking/readme.md) (story 9.3).

---

## Application

### Use Cases

Files: `src/lib/contexts/routines/application/<verb-noun>.use-case.ts`. Every use case takes `userId` and checks ownership through the repository (`currentUserId`).

| # | Use case | Purpose | Story | Status |
|---|---|---|---|---|
| 1 | `ListProgramsUseCase` | Own programs, active first, with routine names (FR-RT-001). `archived: true` lists archived ones | 8.2 | planned |
| 2 | `GetProgramUseCase` | One program with routines and exercises; `canEdit` for the owner, read-only for siblings (copy actions) | 8.2 | planned |
| 3 | `CreateProgramUseCase` | Name 1–60, description ≤ 500, zero routines, limit 20 (FR-RT-002) | 8.2 | planned |
| 4 | `UpdateProgramUseCase` | Rename / describe (FR-RT-003) | 8.2 | planned |
| 5 | `ArchiveProgramUseCase` | Archive or restore (`archived: boolean`); not the active program (FR-RT-003) | 8.2 | planned |
| 6 | `DeleteProgramUseCase` | Only without workout references and not active (FR-RT-003) | 8.2 | planned |
| 7 | `SetActiveProgramUseCase` | Set `active_program_id`, restart rotation (FR-RT-004, FR-RT-013) | 8.2 | planned |
| 8 | `AdoptTemplateUseCase` | Deep-copy a template, optionally activate (FR-RT-005); also used by the 006 user migration | 8.1 | planned |
| 9 | `CopyProgramUseCase` | Deep-copy a family member's program (FR-RT-006 *Guardar programa*) | 8.2 | planned |
| 10 | `CopyRoutineUseCase` | Copy one routine into my program or "Copiadas" (FR-RT-006 *Guardar rutina*, FR-SO-009) | 8.2 | planned |
| 11 | `GetRoutineUseCase` | Routine with exercises for the builder and offline cache | 8.2 | planned |
| 12 | `SaveRoutineUseCase` | Create or update a routine with all its exercises in one transaction (FR-RT-007, FR-RT-008) | 8.2 | planned |
| 13 | `ReorderRoutinesUseCase` | New rotation order; restarts the rotation (FR-RT-009, FR-RT-013) | 8.2 | planned |
| 14 | `DuplicateRoutineUseCase` | Copy inside the same program, appended (FR-RT-009) | 8.2 | planned |
| 15 | `ArchiveRoutineUseCase` | Archive or restore a routine (FR-RT-009 fallback for delete) | 8.2 | planned |
| 16 | `DeleteRoutineUseCase` | Only without workout references (FR-RT-009) | 8.2 | planned |
| 17 | `GetNextWorkoutUseCase` | Rotation + dashboard card data (FR-RT-010..014); replaces `GetTodayWorkoutUseCase` | 8.3 | planned |
| 18 | `SaveWorkoutAsRoutineUseCase` | Completed workout → routine (FR-RT-018), via `WorkoutSnapshotPort` | 9.3 | planned |
| 19 | `ListTemplatesUseCase` | The 7 templates with chips (FR-RT-017) | 8.4 | planned |
| 20 | `GetTemplatePreviewUseCase` | Template routines and exercises by slug (FR-RT-017) | 8.4 | planned |
| 21 | `SubmitOnboardingUseCase` | Store answers + `onboarding_completed_at`, return recommendations (FR-RT-015, FR-RT-016) | 8.4 | planned |
| 22 | `DismissOnboardingUseCase` | Close the wizard or "Mantener mi programa actual": set `onboarding_completed_at`, answers untouched | 8.4 | planned |
| 23 | `RecommendProgramsUseCase` | `recommendPrograms(templates, answers)` → 1 + 2 alternatives (FR-RT-016) | 8.4 | planned |
| — | `seedProgramTemplates(db)` (seed function) | Idempotent upsert of the 7 templates by `slug` from `db/seed-data/program-templates.ts` | 8.1 | planned |

### Orchestration

Rotation anchor: the rotation only counts workouts completed after the active program's `rotationAnchorAt` (`routines.rotation_anchor_at`, migration 006). `ProgramRepository.touchRotationAnchor(programId, now)` is the only writer of that column (activate, reorder, create/adopt/copy).

1. `ListProgramsUseCase({ userId, archived = false })`: `settings.find(userId)` → `programs.listByOwner(userId, { archived })` → mark `isActive`, active first, then `createdAt` DESC.
2. `GetProgramUseCase({ userId, programId })`: `programs.findWithRoutines(programId)` (templates excluded: use `GetTemplatePreview`) → `canEdit = program.ownerId === userId`.
3. `CreateProgramUseCase({ userId, name, description })`: validate → `programs.countByOwner(userId) < 20` else `ProgramLimitReachedError` → `programs.create(...)` (anchor = now).
4. `UpdateProgramUseCase({ userId, programId, patch })`: validate → `programs.update(programId, patch, userId)` (does not move the anchor).
5. `ArchiveProgramUseCase({ userId, programId, archived })`: archiving the active program → `ActiveProgramError` → `programs.setArchived(programId, archived, userId)`.
6. `DeleteProgramUseCase({ userId, programId })`: active → `ActiveProgramError`; `programs.hasWorkoutReferences({ programId })` → `ProgramInUseError` → `programs.delete(programId, userId)` (cascades routines and routine exercises).
7. `SetActiveProgramUseCase({ userId, programId, now? })`: program owned and not archived (`ProgramArchivedError`) → `settings.setActiveProgram(userId, programId)` → `programs.touchRotationAnchor(programId, now)`.
8. `AdoptTemplateUseCase({ userId, slug, activate = true, now? })`: `programs.findTemplateBySlug(slug)` → limit 20 → `programs.adoptTemplate(template.id, userId)` (deep copy: program with `ownerId`, `sourceTemplateId`, `isTemplate = false`, `slug = null`, metadata kept; routines with the same `dayNumber`; every routine-exercise field) → if `activate`, run 7. Adopting the same template twice creates a second copy (Hevy behaviour).
9. `CopyProgramUseCase({ userId, programId })`: source must be a user program (templates → 8) → limit 20 → `exerciseCatalog.findUsableByIds(allExerciseIds, userId)` → `programs.copyProgram(programId, userId, { skipExerciseIds })` → `{ program, skippedExercises }`. Decision: exercises the user may not pick (a sibling's custom ones) are skipped and reported ("N ejercicios personalizados no se copiaron").
10. `CopyRoutineUseCase({ userId, routineId, targetProgramId? })`: target = given own program, or the user's non-archived program named `ProgramNames.CopiedRoutines`, created if missing → routine limit 14 → same exercise filtering as 9 → `programs.copyRoutine(routineId, targetId, userId, { skipExerciseIds })`, appended at `max(dayNumber) + 1`.
11. `GetRoutineUseCase({ userId, routineId })`: `programs.findRoutineWithExercises(routineId)` → read-all; `canEdit` when the parent program is owned.
12. `SaveRoutineUseCase({ userId, input })`:
    - Parent program owned (`ProgramOwnershipError`), not a template (`TemplateImmutableError`), not archived (`ProgramArchivedError`).
    - `validateRoutineInput(input)` → `RoutineValidationError`. Create: routine count < 14 → `RoutineLimitReachedError`.
    - Exercise IDs not already stored in this routine → `exerciseCatalog.findUsableByIds(ids, userId)` → first missing ID → `ExerciseNotPickableError`.
    - `programs.saveRoutine(input, userId)` in **one transaction**: insert or update the `routine_days` row (create: `dayNumber = max + 1`), delete the routine's `routine_exercises`, insert the new rows with `exerciseOrder` 1..n, `targetReps = targetRepsMax ?? RoutineExerciseDefaults.LegacyTargetReps`, superset groups renumbered. Deleting and re-inserting is safe: nothing references `routine_exercises`. Editing never moves the rotation anchor.
13. `ReorderRoutinesUseCase({ userId, programId, orderedRoutineIds, now? })`: the IDs must equal the program's non-archived routines → `programs.reorderRoutines(programId, orderedRoutineIds, userId)` (active 1..k, archived after) → `programs.touchRotationAnchor(programId, now)` (FR-RT-013).
14. `DuplicateRoutineUseCase({ userId, routineId })`: limit 14 → `programs.duplicateRoutine(routineId, userId)`: name + `ProgramNames.DuplicateSuffix` (truncated to 60), all exercises, appended last. Rotation not restarted.
15. `ArchiveRoutineUseCase({ userId, routineId, archived })`: `programs.setRoutineArchived(routineId, archived, userId)`; archived routines move behind the active ones, restored ones go last among the active ones. Rotation not restarted; archived routines are skipped by `computeNextRoutine`.
16. `DeleteRoutineUseCase({ userId, routineId })`: `programs.hasWorkoutReferences({ routineId })` → `RoutineInUseError` → `programs.deleteRoutine(routineId, userId)` → remaining `dayNumber`s compacted (relative order kept, rotation unaffected).
17. `GetNextWorkoutUseCase({ userId, now? })` (ADR-019 §1):
    - `settings.find(userId)`; no `activeProgramId` → `{ kind: 'no_program' }` (FR-RT-014).
    - `programs.findWithRoutines(activeProgramId)`; no non-archived routine → `{ kind: 'empty_program' }`.
    - `last = rotation.findLastCompletedInProgram(userId, programId, program.rotationAnchorAt)`; `lastDayNumber` = `dayNumber` of `last.routineDayId` in this program (archived included), or undefined.
    - `next = computeNextRoutine(activeRoutines, lastDayNumber)`.
    - `lastDone = rotation.findLastDoneByRoutine(userId, routineIds)` (no anchor: the real last date).
    - Build one `RoutineCard` per active routine: exercise list (name, sets × range), `estimateRoutineMinutes(exercises, settings.defaultRestSeconds)`, distinct primary `muscleGroups`, `lastDoneAt`, `daysSince(lastDoneAt, now, settings.timezone)`.
    - Return `{ kind: 'next', program, next, others }`. Readiness and fatigue markers are added by the dashboard page from progression ([FR-PG-011](../../../prd/features/progression.md#fr-pg-011), story 10.4) using `muscleGroups`.
18. `SaveWorkoutAsRoutineUseCase({ userId, workoutId, destination })`, `destination` = `{ programId }` or `{ newProgramName }` (default `ProgramNames.SavedRoutines`):
    - `snapshot = workoutSnapshot.findCompletedSnapshot(workoutId)` → missing → 404; `snapshot.userId !== userId` → 403; not completed → `WorkoutNotSavableError('not_completed')`.
    - `deriveRoutineFromWorkout(snapshot)` (FR-RT-018), per workout exercise in `position` order: working sets = completed sets with `setType !== 'warmup'`; exercises with 0 working sets are skipped; `targetSets` = working count (max 20); `warmupSets` = completed warm-ups (max 5); range = `[min, max]` of logged reps (rep types) or `durationSeconds` (duration types), widened to `max = min + 2` when closer, capped at 100 (`min` shifted down); distance types → `null`; `restSeconds`, `supersetGroup` (renumbered; a group left with one member becomes `null`) and `notes` (≤ 300) copied; routine `name` = workout name (≤ 60), routine `notes` = workout notes (≤ 500).
    - Non-pickable exercises (an archived custom one) are skipped and counted. Nothing left → `WorkoutNotSavableError('empty')`.
    - Destination: own non-archived program, or `CreateProgramUseCase` (limit 20). Then step 12 with the draft. Returns `{ routine, skippedExercises }`.
19. `ListTemplatesUseCase()`: `programs.listTemplates()` → sorted by `TemplateSeedOrder`.
20. `GetTemplatePreviewUseCase({ slug })`: `programs.findTemplateBySlug(slug)` → `TemplateNotFoundError` → routines with exercises (name, sets × range, rest).
21. `SubmitOnboardingUseCase({ userId, answers, now? })`: validate against `OnboardingOptions` (`focus` defaults to `balanced`) → `settings.saveOnboarding(userId, answers, now)` → step 23 → `{ recommendations, hasActiveProgram }`.
22. `DismissOnboardingUseCase({ userId, now? })`: `settings.markOnboardingCompleted(userId, now)`. The dashboard then shows FR-RT-014 when there is no active program.
23. `RecommendProgramsUseCase({ userId, answers? })`: `answers ?? settings.onboarding` → `recommendPrograms(await programs.listTemplates(), answers)` → first `1 + RecommendationWeights.Alternatives`.

**User migration (story 8.1).** For every profile without `active_program_id`: adopt `LegacyRoutineTemplate[routineType]` and set it active, anchor = migration time ([ADR-018 §4](../../decisions/018-user-owned-programs.md)). Supabase: SQL function `adopt_template(p_user, p_template)` inside `006_programs.sql`. SQLite: `migrateUsersToPrograms(db)` in `db/seed.ts`, calling `SqliteProgramRepository.adoptTemplate` in a transaction. Phase 1 workouts keep their template `routine_day_id` and have `program_id = NULL`, so every migrated user starts the rotation at day 1.

---

## Infrastructure

Per [ADR-007](../../decisions/007-repository-pattern.md) and [ADR-011](../../decisions/011-implements-not-extends.md). One repository manages the whole program aggregate, as the Phase 1 `RoutineRepository` did.

### Abstract Classes (Contracts)

```ts
// src/lib/contexts/routines/domain/program.repository.ts
export abstract class ProgramRepository {
  // Programs
  abstract listByOwner(ownerId: string, opts: { archived: boolean }): Promise<ProgramSummary[]>;
  abstract countByOwner(ownerId: string): Promise<number>;            // archived included
  abstract findById(id: string): Promise<Program | undefined>;
  abstract findWithRoutines(id: string): Promise<ProgramWithRoutines | undefined>;
  abstract create(input: { ownerId: string; name: string; description: string | null }): Promise<Program>;
  abstract update(id: string, patch: Partial<Pick<Program, 'name' | 'description'>>, currentUserId: string): Promise<Program>;
  abstract setArchived(id: string, archived: boolean, currentUserId: string): Promise<Program>;
  abstract delete(id: string, currentUserId: string): Promise<void>;
  abstract touchRotationAnchor(programId: string, at: Date): Promise<void>;
  /** Any workout whose routine_day_id belongs to the program/routine, or whose program_id is the program. */
  abstract hasWorkoutReferences(ref: { programId: string } | { routineId: string }): Promise<boolean>;

  // Templates
  abstract listTemplates(): Promise<TemplateMeta[]>;
  abstract findTemplateBySlug(slug: string): Promise<ProgramWithRoutines | undefined>;
  /** Deep copy template → program owned by ownerId (one transaction / adopt_template()). */
  abstract adoptTemplate(templateId: string, ownerId: string): Promise<Program>;

  // Copies (family)
  abstract copyProgram(sourceId: string, ownerId: string, opts: { skipExerciseIds: string[] }): Promise<Program>;
  abstract copyRoutine(sourceRoutineId: string, targetProgramId: string, currentUserId: string, opts: { skipExerciseIds: string[] }): Promise<Routine>;

  // Routines
  abstract findRoutineById(id: string): Promise<Routine | undefined>;
  abstract findRoutineWithExercises(id: string): Promise<(RoutineWithExercises & { program: Program }) | undefined>;
  /** Upsert routine + replace all its exercises, in one transaction. */
  abstract saveRoutine(input: SaveRoutineInput, currentUserId: string): Promise<RoutineWithExercises>;
  abstract reorderRoutines(programId: string, orderedRoutineIds: string[], currentUserId: string): Promise<void>;
  abstract duplicateRoutine(routineId: string, currentUserId: string): Promise<Routine>;
  abstract setRoutineArchived(routineId: string, archived: boolean, currentUserId: string): Promise<Routine>;
  abstract deleteRoutine(routineId: string, currentUserId: string): Promise<void>;
}

// src/lib/contexts/routines/domain/rotation.query.ts
export abstract class RotationQuery {
  /** Latest workout with status 'completed', program_id = programId, completed_at > since. */
  abstract findLastCompletedInProgram(
    userId: string, programId: string, since: Date,
  ): Promise<{ routineDayId: string; completedAt: Date } | undefined>;
  /** MAX(completed_at) per routine_day_id for the user's completed workouts. Missing = never. */
  abstract findLastDoneByRoutine(userId: string, routineDayIds: string[]): Promise<Map<string, Date>>;
}

// src/lib/contexts/routines/domain/profile-program-settings.ts
export abstract class ProfileProgramSettings {
  abstract find(userId: string): Promise<ProgramSettings | undefined>;
  abstract setActiveProgram(userId: string, programId: string): Promise<void>;
  abstract saveOnboarding(userId: string, answers: OnboardingAnswers, completedAt: Date): Promise<void>;
  abstract markOnboardingCompleted(userId: string, completedAt: Date): Promise<void>;
}

// src/lib/contexts/routines/domain/routine-plan.port.ts — PROVIDED to workout-tracking (9.1)
export interface RoutinePlan {
  routineDayId: string;              // → workouts.routine_day_id
  programId: string;                 // → workouts.program_id
  ownerId: string | null;            // program owner; null = template (Phase 1 history only)
  name: string;                      // routine_days.day_name → workouts.name default
  notes: string | null;              // routine_days.notes (shown in the live workout)
  exercises: Array<{
    exerciseId: string;
    position: number;                // exerciseOrder
    targetSets: number;
    targetRepsMin: number | null;
    targetRepsMax: number | null;
    warmupSets: number;
    restSeconds: number | null;      // null = profiles.default_rest_seconds
    supersetGroup: number | null;
    targetRpe: number | null;
    notes: string | null;
  }>;
}
export abstract class RoutinePlanPort {
  abstract findRoutinePlan(routineDayId: string): Promise<RoutinePlan | undefined>;
}

// Consumed from workout-tracking (story 9.3). Workout-tracking owns the class and its adapter;
// this is the contract routines needs.
export interface WorkoutSnapshot {
  workoutId: string;
  userId: string;
  status: 'in_progress' | 'completed';
  name: string;
  notes: string | null;
  exercises: Array<{
    exerciseId: string;
    position: number;
    supersetGroup: number | null;
    restSeconds: number | null;
    notes: string | null;
    sets: Array<{ setType: 'normal' | 'warmup' | 'drop' | 'failure'; reps: number | null; durationSeconds: number | null; completed: boolean }>;
  }>;
}
export abstract class WorkoutSnapshotPort {
  abstract findCompletedSnapshot(workoutId: string): Promise<WorkoutSnapshot | undefined>;
}
```

`RoutinePlanAdapter implements RoutinePlanPort` (`application/routine-plan.adapter.ts`) wraps `ProgramRepository.findRoutineWithExercises`. Workout-tracking reads exercise metadata through `ExerciseCatalogPort` and checks `ownerId === userId` before starting (FR-WT-018: only own routines; a sibling's routine is copied first).

### SQLite (`infrastructure/sqlite/`)

- `SqliteProgramRepository`, `SqliteRotationQuery`, `SqliteProfileProgramSettings` take the Drizzle `Db`.
- Multi-row writes (`adoptTemplate`, `copyProgram`, `copyRoutine`, `saveRoutine`, `reorderRoutines`, `duplicateRoutine`, `deleteRoutine` + compaction) run in `db.transaction(...)`. New IDs come from `crypto.randomUUID()`.
- Write-own guards in code: the program's `ownerId === currentUserId`, `ownerId !== null` (templates), since SQLite has no RLS.
- Exercise joins read the `exercises` table directly (own read model, like `SqliteExerciseQueryRepository` in progress); no import of exercise-library repositories.
- `findLastCompletedInProgram`: `SELECT routine_day_id, completed_at FROM workouts WHERE user_id = ? AND program_id = ? AND status = 'completed' AND completed_at > ? ORDER BY completed_at DESC LIMIT 1` (index `idx_workouts_completed`).

### Supabase (`infrastructure/supabase/`)

- `SupabaseProgramRepository`, `SupabaseRotationQuery`, `SupabaseProfileProgramSettings`.
- The JS client has no transactions, so every multi-row write is a `SECURITY INVOKER` SQL function (RLS still applies): `adopt_template(p_user, p_template)` (defined in 006), plus `copy_program(p_source, p_skip_exercise_ids)`, `copy_routine(p_source, p_target, p_skip_exercise_ids)`, `save_routine(p_payload jsonb)`, `reorder_routine_days(p_program, p_ordered_ids)`, `duplicate_routine(p_routine)`, `delete_routine(p_routine)`. These functions are not yet in the 006 DDL of [database-schema.md](../../database-schema.md#006--programs-adr-018-adr-019); story 8.1/8.2 adds them to `006_programs.sql`.
- Reordering permutes `day_number` under the Phase 1 `UNIQUE(routine_id, day_number)` while `CHECK (day_number BETWEEN 1 AND 14)` forbids temporary values. The constraint must be `DEFERRABLE INITIALLY IMMEDIATE` so a single `UPDATE … SET day_number = CASE …` is checked at statement end (Postgres checks non-deferrable unique constraints per row). The SQLite schema has no such unique index.
- RLS (006): `routines_insert_own` / `routines_update_own` / `routines_delete_own`, `routine_days_write_own`, `routine_exercises_write_own`; templates are not writable. `profiles` writes use the existing own-row policy.

### Migration from workout-tracking

Today `src/lib/contexts/workout-tracking/domain/routine.repository.ts` (`RoutineRepository`, with SQLite and Supabase implementations) is the routine aggregate, read-only, seed-only (ADR-003). It moves out:

| Today (workout-tracking) | Used by | Phase 2 | Story |
|---|---|---|---|
| `RoutineRepository.findAll()` | nothing outside tests | `ProgramRepository.listByOwner` / `listTemplates` | 8.1 |
| `RoutineRepository.findById(id)` | nothing outside tests | `ProgramRepository.findById` | 8.1 |
| `RoutineRepository.findDayByTypeAndDayNumber(type, day)` | `GetTodayWorkoutUseCase` (weekday model) | **Removed** with `GetTodayWorkoutUseCase` (replaced by `GetNextWorkoutUseCase`) | 8.3 |
| `RoutineRepository.findDayWithExercises(dayId)` and `RoutineDayWithExercises` | `GetTodayWorkoutUseCase`, `src/pages/workout/[id].astro` | `RoutinePlanPort.findRoutinePlan(routineDayId)` / `RoutinePlan`. The live workout reads its own `workout_exercises` after start | 9.1 |
| `StartWorkoutUseCase(routineRepository, …)` (injected, unused) | `/api/workouts` | Takes `RoutinePlanPort` to copy routine exercises into `workout_exercises` and set `workouts.program_id` | 9.1 |
| `routineRepository` export in `workout-tracking.composition.ts` | `src/pages/workout/[id].astro` | Deleted together with `routine.repository.ts` and both implementations | 9.1 |

What stays in workout-tracking: `WorkoutRepository` (its history query keeps joining `routine_days` for Phase 1 names until it reads `workouts.name`), `ProfileRepository` (display name, unit, training settings), `PhotoRepository`. The `profiles` columns `active_program_id` and onboarding answers are written only through `ProfileProgramSettings`. During Round 8 both coexist: the Phase 1 `routine.repository.ts` keeps serving the old workout page until 9.1 deletes it; the dashboard switches to `GetNextWorkoutUseCase` in 8.3 and still posts `routine_day_id` to `/api/workouts`.

### Wiring (Per-Context Composition)

```ts
// src/lib/contexts/routines/routines.composition.ts
import { exerciseCatalogPort } from '@/lib/contexts/exercise-library/exercise-library.composition';
import { workoutSnapshotPort } from '@/lib/contexts/workout-tracking/workout-snapshot.instance'; // story 9.3 (see below)

const backend = resolveStorageBackend();
const programRepository = buildProgramRepository(backend);
const rotationQuery = buildRotationQuery(backend);
const settings = buildProfileProgramSettings(backend);

export { routinePlanPort } from './routine-plan.instance'; // RoutinePlanAdapter over its own ProgramRepository

export const createProgramUseCase = new CreateProgramUseCase(programRepository);
export const setActiveProgramUseCase = new SetActiveProgramUseCase(programRepository, settings);
export const adoptTemplateUseCase = new AdoptTemplateUseCase(programRepository, setActiveProgramUseCase);
export const saveRoutineUseCase = new SaveRoutineUseCase(programRepository, exerciseCatalogPort);
export const getNextWorkoutUseCase = new GetNextWorkoutUseCase(programRepository, rotationQuery, settings);
export const recommendProgramsUseCase = new RecommendProgramsUseCase(programRepository, settings);
export const submitOnboardingUseCase = new SubmitOnboardingUseCase(settings, recommendProgramsUseCase);
export const saveWorkoutAsRoutineUseCase = new SaveWorkoutAsRoutineUseCase(
  workoutSnapshotPort, exerciseCatalogPort, createProgramUseCase, saveRoutineUseCase, programRepository,
);
// … one export per use case in the table above
```

Dependency direction: workout-tracking imports `routinePlanPort` from here and routines imports `workoutSnapshotPort` from workout-tracking. To avoid an import cycle between the two composition files, each port instance is exported from a small module (`routines/routine-plan.instance.ts`, `workout-tracking/workout-snapshot.instance.ts`) that builds only the adapter and its repository.

---

## UI

### Components

Specs belong in [components.md → Programs & Routines](../../components.md#programs--routines). Files in `src/components/`, kebab-case.

| Component | File | Notes |
|---|---|---|
| `ProgramList`, `ProgramCard` | `program-list.astro`, `program-card.astro` | Name, "Activo" badge, routine names, menu (*Activar*, *Editar*, *Archivar*, *Eliminar*) |
| `RoutineBuilder` | `routine-builder.tsx` (island) | FR-RT-007/008; hosts `ExercisePicker` ([exercise-library](../exercise-library/readme.md)); unsaved-changes guard |
| `RoutineExerciseRow` | `routine-exercise-row.tsx` | Sets, rep range (seconds for duration types, hidden for distance types), warm-up sets, rest (15 s steps, "Por defecto"), RPE, superset link, note |
| `NextWorkoutCard` | `next-workout-card.astro` | FR-RT-011: routine, program, exercises (sets × range), "≈ N min", *Empezar* |
| `RoutinePickerList` | `routine-picker-list.astro` | FR-RT-012: *Elegir otra rutina* with "hecha hace N días" and *Entrenamiento libre* |
| `OnboardingWizard` | `onboarding-wizard.tsx` (island) | FR-RT-015/016: 5 steps, progress dots, back/next, results screen |
| `TemplateCard` | `template-card.astro` | Name, chips: level, goal, days/week, equipment (FR-RT-017) |
| `ProgramDestinationDialog` | `program-destination-dialog.tsx` | Choose an own program or "Nuevo programa" (copy routine, save workout as routine) |

### Interactive components (React islands)

- `routine-builder.tsx` — local state for the whole routine; one `POST`/`PUT` on *Guardar* (no per-field autosave). Drag handles and up/down buttons for reorder.
- `program-routines.tsx` — routine list on `/train/programs/[id]` with drag reorder (`PUT …/routines/order`), *Duplicar*, *Archivar*, *Eliminar*.
- `onboarding-wizard.tsx` — steps in memory; `POST /api/onboarding` on the last step; renders the recommendations from the response.

### Pages

| Route | Rendering | Content | Story |
|---|---|---|---|
| `/train` | SSR | FR-RT-001: *Mis programas* (active first), *Explorar plantillas*, *Entrenamiento libre*, *Biblioteca de ejercicios*; *Nuevo programa*; link *Archivados* (`?archived=1`) | 8.2 |
| `/train/programs/[id]` | SSR + `program-routines` | Owner: routines in rotation order, *Nueva rutina*, *Empezar* per routine, program menu. Sibling: read-only with *Guardar programa* / *Guardar rutina* (FR-RT-006) | 8.2 |
| `/train/routines/new?program=<id>` | SSR + `routine-builder` | New routine in program `<id>` (owner only) | 8.2 |
| `/train/routines/[id]/edit` | SSR + `routine-builder` | Edit (owner only, 403 otherwise) | 8.2 |
| `/train/templates` | SSR | FR-RT-017: 7 templates in seed order | 8.4 |
| `/train/templates/[slug]` | SSR | Preview: description, chips, routines with exercises; *Usar plantilla* with "Activar ahora" (checked) | 8.4 |
| `/onboarding` | SSR + `onboarding-wizard` | FR-RT-015/016 | 8.4 |
| `/dashboard` (composition) | SSR | `getNextWorkoutUseCase` → `NextWorkoutCard` + `RoutinePickerList`, or the "Elige tu programa" card (FR-RT-014). Redirects to `/onboarding` when `onboardingCompletedAt` is null | 8.3, 8.4 |

### API endpoints

All require a session (401). JSON errors `{ error: { code, message, issues? } }`.

| Method | Path | Use case | Notes |
|---|---|---|---|
| GET | `/api/programs` | `ListProgramsUseCase` | `?archived=1` |
| POST | `/api/programs` | `CreateProgramUseCase` | 201; 409 `program_limit` |
| GET | `/api/programs/[id]` | `GetProgramUseCase` | Read-all; templates → 404 (use templates API) |
| PATCH | `/api/programs/[id]` | `UpdateProgramUseCase` | 403 not owner |
| DELETE | `/api/programs/[id]` | `DeleteProgramUseCase` | 409 `in_use` (UI offers *Archivar*) or `active` |
| POST | `/api/programs/[id]/archive` | `ArchiveProgramUseCase` | `archived: true`; 409 `active` |
| POST | `/api/programs/[id]/restore` | `ArchiveProgramUseCase` | `archived: false` |
| POST | `/api/programs/[id]/activate` | `SetActiveProgramUseCase` | 409 `archived` |
| POST | `/api/programs/[id]/copy` | `CopyProgramUseCase` | 201 `{ program, skippedExercises }` |
| PUT | `/api/programs/[id]/routines/order` | `ReorderRoutinesUseCase` | Body `{ routineIds }`; 400 when the set differs |
| GET | `/api/routines/next` | `GetNextWorkoutUseCase` | Cached stale-while-revalidate by the service worker for offline start ([ADR-025 §6](../../decisions/025-offline-live-workout.md)) |
| POST | `/api/routines` | `SaveRoutineUseCase` | Create; body `SaveRoutineInput` without `routineId`; 201 |
| GET | `/api/routines/[id]` | `GetRoutineUseCase` | Read-all |
| PUT | `/api/routines/[id]` | `SaveRoutineUseCase` | Full replace of the routine and its exercises |
| DELETE | `/api/routines/[id]` | `DeleteRoutineUseCase` | 409 `in_use` |
| POST | `/api/routines/[id]/archive` | `ArchiveRoutineUseCase` | `archived: true` |
| POST | `/api/routines/[id]/restore` | `ArchiveRoutineUseCase` | `archived: false` |
| POST | `/api/routines/[id]/duplicate` | `DuplicateRoutineUseCase` | 201; 409 `routine_limit` |
| POST | `/api/routines/[id]/copy` | `CopyRoutineUseCase` | Body `{ targetProgramId? }`; 201 `{ routine, skippedExercises }` |
| GET | `/api/templates` | `ListTemplatesUseCase` | Public data, `Cache-Control: public, max-age=3600` |
| GET | `/api/templates/[slug]` | `GetTemplatePreviewUseCase` | 404 unknown slug |
| POST | `/api/templates/[slug]/adopt` | `AdoptTemplateUseCase` | Body `{ activate }` (default true); 201 `{ program }`; 409 `program_limit` |
| POST | `/api/onboarding` | `SubmitOnboardingUseCase` | Body `OnboardingAnswers`; 200 `{ recommendations, hasActiveProgram }` |
| POST | `/api/onboarding/dismiss` | `DismissOnboardingUseCase` | 204 |
| GET | `/api/onboarding/recommendations` | `RecommendProgramsUseCase` | Uses stored answers; 404 when none |
| POST | `/api/workouts/[id]/save-as-routine` | `SaveWorkoutAsRoutineUseCase` | Routines use case behind a workouts path. Body `{ programId }` or `{ newProgramName }`; 201 `{ routine, skippedExercises }` |

---

## Testing

Per [ADR-009](../../decisions/009-object-mothers.md): real SQLite, Object Mothers, no mocks. Files in `tests/routines/`, harness `tests/routines/test-db.ts` (004 + 006 DDL, exercise seed subset).

| What | File | Kind |
|---|---|---|
| `scoreTemplate`, `recommendPrograms`, `buildReason` | `recommendation.test.ts` | Table-driven over the 7 seeded templates: equipment filter, days = 2 scored as 3, negative days term, focus only when not `balanced`, ties by `TemplateSeedOrder`, reason order |
| `computeNextRoutine`, `daysSince` | `rotation.test.ts` | No history → first; last = last routine → wraps; archived skipped; timezone day boundaries |
| `estimateRoutineMinutes` | `duration-estimate.test.ts` | Default rest vs explicit, warm-ups counted, rounding to 5, minimum 5 |
| `validateRoutineInput` | `routine.validation.test.ts` | Every FR-RT-008 rule; superset contiguity and renumbering |
| `deriveRoutineFromWorkout` | `routine-from-workout.test.ts` | Warm-ups excluded from target sets, widening (10,10 → 10–12), cap at 100, distance → null, skipped exercises, broken superset → null |
| `SqliteProgramRepository` | `sqlite-program.repository.test.ts` | Deep copy equality (adopt, copy), skipped exercises, `hasWorkoutReferences`, reorder and compaction keep `dayNumber` dense, ownership guards, templates immutable |
| `SqliteRotationQuery` | `sqlite-rotation.query.test.ts` | Anchor filter, only completed, only the program |
| Use cases | one `*.use-case.test.ts` per row of the table | Happy path + each domain error; `now` injected |
| Seed + migration | `seed-program-templates.test.ts`, `migrate-users-to-programs.test.ts` | 7 templates, idempotent; every Phase 1 profile gets an active adopted program; Phase 1 workouts still point at template days |
| Phase 1 regression | `phase-1-fixture.test.ts` (`tests/fixtures/phase-1.db`) | After 006, history, progress and family pages return the same numbers |
| RLS | `tests/supabase/rls-programs.integration.test.ts` | As a **non-owner**: cannot update/delete a sibling's program, cannot insert `routine_days`/`routine_exercises` into it, cannot write templates; can read and copy both |

Object Mothers (`tests/routines/mothers/`):

```ts
// import type { NewRoutine as NewProgramRow } from '@db/schema';
export class ProgramMother {
  static template(overrides: Partial<NewProgramRow> = {}): NewProgramRow {
    return {
      id: crypto.randomUUID(), name: 'Full Body Beginner 3-Day', ownerId: null, isTemplate: true,
      slug: `tpl-${faker.string.alpha(6)}`, level: 'beginner', goal: 'general', daysPerWeek: 3,
      equipmentProfile: 'full_gym', focus: 'balanced', ...overrides,
    };
  }
  static owned(ownerId: string, overrides: Partial<NewProgramRow> = {}): NewProgramRow {
    return { id: crypto.randomUUID(), name: `Programa ${faker.string.alpha(5)}`, ownerId, isTemplate: false, ...overrides };
  }
}

export class OnboardingAnswersMother {
  static create(overrides: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
    return { goal: 'general', experience: 'beginner', daysPerWeek: 3, equipment: 'dumbbells', focus: 'balanced', ...overrides };
  }
}
// RoutineMother.create(programId, dayNumber), RoutineExerciseMother.create(routineId, exerciseId, order)
```

Example skeleton:

```ts
// tests/routines/get-next-workout.use-case.test.ts
describe('GetNextWorkoutUseCase', () => {
  it('returns the routine after the last completed one and wraps around', async () => {
    const { db, close } = createTestDb();
    const userId = await insertProfile(db);
    const program = await insertProgramWithRoutines(db, ProgramMother.owned(userId), ['Push', 'Pull', 'Legs']);
    await activate(db, userId, program.id, new Date('2026-09-01T10:00:00Z'));
    await insertCompletedWorkout(db, { userId, programId: program.id, routineDayId: program.routines[2].id,
      completedAt: new Date('2026-09-02T18:00:00Z') });

    const useCase = new GetNextWorkoutUseCase(
      new SqliteProgramRepository(db), new SqliteRotationQuery(db), new SqliteProfileProgramSettings(db),
    );
    const view = await useCase.execute({ userId, now: new Date('2026-09-03T08:00:00Z') });

    expect(view.kind).toBe('next');
    if (view.kind === 'next') expect(view.next.routine.dayName).toBe('Push');
    close();
  });
});
```

---

## Flows

- [build-routine.flow.md](./flows/build-routine.flow.md) — create and edit a routine in the builder.
- [next-workout.flow.md](./flows/next-workout.flow.md) — dashboard "Siguiente entrenamiento" and rotation.
- [onboarding.flow.md](./flows/onboarding.flow.md) — questionnaire, recommendation, adoption.
- [adopt-template.flow.md](./flows/adopt-template.flow.md) — templates browser, preview, *Usar plantilla*.
