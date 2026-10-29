# Progression Context

Parent: [../readme.md](../readme.md) · PRD: [progression.md](../../../prd/features/progression.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Decisions | [ADR-021](../../decisions/021-progression-engine.md), [ADR-022](../../decisions/022-readiness-and-recovery.md), [ADR-020](../../decisions/020-personal-records.md) (e1RM) |
| Schema | [007 — Progression](../../database-schema.md#007--progression-adr-021-adr-022) |
| Stories | [10.2](../../../stories/phase-2/round-10/story-10.2.md), [10.3](../../../stories/phase-2/round-10/story-10.3.md), [10.4](../../../stories/phase-2/round-10/story-10.4.md) |

## Purpose

The Gravl part of gym-up: what to lift next session (double progression), plateau detection with user-chosen responses, program-wide deload weeks, the readiness check-in that lightens a session, the muscle recovery map and soft warnings. Requirements: [FR-PG-001 … FR-PG-013](../../../prd/features/progression.md).

Everything is **deterministic and pure**. The engine never calls AI and never touches the database: use cases load history through ports, call pure functions, and return suggestions. The same pure modules are bundled in the live-workout island where a client-side recomputation is needed (readiness adjustment).

| Owns | Reads (through ports, never through another context's repositories) | Provides |
|---|---|---|
| `exercise_progression_overrides`, `readiness_checkins`, `profiles.deload_until`, `profiles.last_deload_at`, `profiles.deload_snoozed_until` | SQL over `workouts`, `workout_exercises`, `workout_entries` (history) and `profiles` settings · `ExerciseCatalogPort` ([exercise-library](../exercise-library/readme.md)) for equipment, type and muscles · `RoutinePlanPort` ([routines](../routines/readme.md)) for target sets and rep ranges | `SuggestionPort` → workout-tracking · `ProgressionInsightsPort` → progress (weekly facts) |

---

## Domain

File naming: **kebab-case**. Domain files in `src/lib/contexts/progression/domain/`.

| File | Content |
|---|---|
| `progression.types.ts` | Types below |
| `progression.constants.ts` | Rule objects below |
| `progression-engine.ts` | `buildExposures`, `topWorkingWeight`, `resolveRepRange`, `incrementFor`, `suggestNext`, `roundToLoadable`, `applySafetyCaps`, `toDisplayWeight`, `fromDisplayWeight` |
| `plateau.ts` | `detectPlateau`, `isPlateauSuppressed`, `isRebuildActive`, `alternateRange` |
| `deload.ts` | `recommendDeload`, `applyDeload` |
| `readiness.ts` | `readinessScore`, `readinessBand`, `applyReadiness` |
| `recovery.ts` | `computeMuscleRecovery`, `softWarnings` |
| `explain-suggestion.ts` | `explainSuggestion`, `firstTimeHint`, `formatWeight`, `formatRepsList` |
| `errors.ts` | `InvalidReadinessAnswerError`, `ExerciseNotPlateauedError`, `UnknownPlateauOptionError` |

All weights in domain inputs and outputs are **kg** ([ADR-006](../../decisions/006-kg-storage.md)). The engine converts to the user's display unit internally only to pick unit-native steps and loadable weights, then converts back.

### `progression.types.ts`

```ts
// src/lib/contexts/progression/domain/progression.types.ts
import type { Exercise, Profile, WorkoutEntry } from '@db/schema';
import type { MuscleGroup } from '@/lib/contexts/exercise-library/domain/exercise-library.constants'; // MuscleGroups, ADR-017 §2 (story 7.1)

export type ExerciseType = NonNullable<Exercise['exerciseType']>; // 7 values, ADR-016 §3
export type Equipment = NonNullable<Exercise['equipment']>;       // 10 values, ADR-017 §2
export type SetType = WorkoutEntry['setType'];                    // 'normal' | 'warmup' | 'drop' | 'failure'
export type WeightUnit = Profile['weightUnit'];                   // 'kg' | 'lbs'

/** A completed set that counts for progression: set_type ∈ {normal, failure} (ADR-021 §1). */
export interface WorkingSet {
  setNumber: number;
  setType: 'normal' | 'failure';
  weight: number;                 // kg; ≤ 0 for assisted_bodyweight (assistance)
  reps: number | null;
  durationSeconds: number | null;
  rpe: number | null;
}

/** One completed workout containing ≥ 1 working set of the exercise (ADR-021 §1). */
export interface Exposure {
  workoutId: string;
  completedAt: Date;              // workouts.completed_at
  isDeload: boolean;              // workouts.is_deload
  routineDayId: string | null;
  sets: WorkingSet[];             // every workout_exercises row of the exercise merged, ordered (position, set_number)
}

export interface RepRange {
  min: number;
  max: number;
  source: 'override' | 'routine' | 'default';
}

export type ReasonCode =
  | 'increase_all_sets_hit_max'
  | 'hold_progressing'
  | 'reduce_two_misses'
  | 'deload'
  | 'readiness_low'
  | 'plateau_rebuild';

export interface Suggestion {
  weight: number;                 // kg, already rounded to a loadable value in the user's unit
  reps: number | null;            // null for duration types
  durationSeconds: number | null; // duration types only (+5 s rule); null otherwise
  sets: number;                   // working sets to prefill
  reason: ReasonCode;
  isDeload: boolean;
  readinessAdjusted: boolean;
}

/** Subset of exercise-library's CatalogExercise (ExerciseCatalogPort.findByIds). */
export interface ExerciseMeta {
  id: string;
  name: string;                   // English (OQ-001)
  exerciseType: ExerciseType;
  equipment: Equipment;
  muscleGroup: MuscleGroup;       // primary
  secondaryMuscles: MuscleGroup[];
}

/** Loading context from profile settings (FR-WT-037). Stored values, kg. */
export interface LoadContext {
  unit: WeightUnit;
  barWeightKg: number;            // profiles.bar_weight_kg
  availablePlatesKg: number[];    // profiles.available_plates_kg (JSON)
}

/** Mapped from RoutinePlanPort.findRoutinePlan(routineDayId).exercises[]. */
export interface RoutineTarget {
  exerciseId: string;
  targetSets: number;
  repMin: number | null;          // targetRepsMin
  repMax: number | null;          // targetRepsMax
}

export interface SuggestNextInput {
  exposures: Exposure[];          // newest first, deload exposures included
  meta: ExerciseMeta;
  range: RepRange;
  targetSets: number | null;      // routine_exercises.target_sets; null in a free workout
  load: LoadContext;
}

export type PlateauMetric = 'e1rm' | 'reps';
export type PlateauOption = 'rebuild' | 'change_range' | 'ignore';

export interface PlateauState {
  exerciseId: string;
  plateaued: boolean;             // raw rule of ADR-021 §5
  suppressed: boolean;            // hidden by a user choice (isPlateauSuppressed)
  metric: PlateauMetric | null;   // null: type not tracked (duration, distance)
  bestBefore: number | null;      // best metric before the window
  bestRecent: number | null;      // best metric inside the window
  exposureCount: number;          // non-deload exposures
}

export type DeloadReason = 'plateaus_after_6_weeks' | 'eight_weeks';

export interface DeloadRecommendation {
  status: 'active' | 'recommended' | 'none';
  reason: DeloadReason | null;    // set when status = 'recommended'
  weeksSinceLastDeload: number | null;
  plateauedExerciseIds: string[]; // active-program exercises that are plateaued
  activeUntil: Date | null;       // profiles.deload_until when status = 'active'
}

export type ReadinessBand = 'good' | 'moderate' | 'low';

export interface ReadinessAnswers {
  sleep: number;                  // 1–5
  energy: number;                 // 1–5
  soreness: number;               // 1–5 (5 = no soreness)
}

export type RecoveryState = 'fresh' | 'recovering' | 'fatigued';

/** One completed working set of the last 7 days with its muscles (input of computeMuscleRecovery). */
export interface MuscleSetRow {
  workoutId: string;
  completedAt: Date;              // workout_entries.completed_at, else workouts.completed_at
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
}

export interface MuscleRecovery {
  muscle: MuscleGroup;
  recoveryPct: number;            // integer 0–100
  state: RecoveryState;
  hoursSince: number;
  windowHours: 48 | 72;
  lastTrainedAt: Date;
  weeklyHardSets: number;         // trailing 7 days, primary 1.0 + secondary 0.5
}

export type SoftWarningCode = 'consecutive_days' | 'high_volume' | 'fatigued_muscle';

export interface SoftWarning {
  code: SoftWarningCode;
  muscles: MuscleGroup[];         // high_volume, fatigued_muscle
  consecutiveDays: number | null; // consecutive_days
}

/** What SuggestionPort returns per exercise (shipped in the live-workout island props, ADR-015). */
export interface ExerciseSuggestion {
  exerciseId: string;
  repRange: RepRange;
  suggestion: Suggestion | null;  // final (after deload + readiness); null = no suggestion
  original: Suggestion | null;    // before readiness — "Usar plan original" (FR-PG-010)
  explanation: string | null;     // FR-PG-002 text for `suggestion`
  firstTimeHint: string | null;   // FR-PG-005 text when there is no exposure
  plateaued: boolean;             // plateaued && !suppressed → amber "Estancado" (FR-PG-006)
}

export interface SuggestionContext {
  routineDayId?: string | null;
  isDeload: boolean;              // workouts.is_deload
  readinessScore?: number | null; // workouts.readiness_score
}
```

### `progression.constants.ts`

```ts
// src/lib/contexts/progression/domain/progression.constants.ts

export const ProgressionDefaults = {
  /** Free workout or routine without a range (ADR-021 §2). "Compound barbell" = equipment barbell | smith_machine. */
  RepRange: {
    CompoundBarbell: { min: 5, max: 8 },
    Other: { min: 8, max: 12 },
  },
  CompoundBarbellEquipment: ['barbell', 'smith_machine'],
  WorkingSetTypes: ['normal', 'failure'],   // ADR-021 §1: warm-ups and drops ignored
  MaxRpeForIncrease: 9.5,                    // a set with rpe ≥ 9.5 blocks Increase
  ReduceFactor: 0.9,                         // reduce_two_misses
  RebuildFactor: 0.9,                        // plateau_rebuild
  DurationStepSeconds: 5,                    // duration types: +5 s per session
  NoSuggestionTypes: ['distance_duration', 'weight_distance'],
  RepOnlyTypes: ['bodyweight_reps', 'assisted_bodyweight'],
  WeightTypes: ['weight_reps', 'weighted_bodyweight'],
} as const;

/** ADR-021 §4: a primary muscle in this list uses the "lower body" column. */
export const LowerBodyMuscles = [
  'quadriceps', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves',
] as const;

/**
 * ADR-021 §4. Steps in the user's display unit.
 * Row key: exercise_type 'weighted_bodyweight' → 'other';
 * equipment plate | band | other | bodyweight → 'other'; else the equipment itself.
 */
export const IncrementTable = {
  kg: {
    barbell:       { lower: 5.0, upper: 2.5 },
    smith_machine: { lower: 5.0, upper: 2.5 },
    dumbbell:      { lower: 2.0, upper: 2.0, upperLight: 1.0, lightBelow: 10 }, // per dumbbell; 1.0 when W < 10 kg
    machine:       { lower: 5.0, upper: 2.5 },
    cable:         { lower: 5.0, upper: 2.5 },
    kettlebell:    { lower: 4.0, upper: 4.0 },
    other:         { lower: 2.5, upper: 2.5 },
  },
  lbs: {
    barbell:       { lower: 10, upper: 5 },
    smith_machine: { lower: 10, upper: 5 },
    dumbbell:      { lower: 5, upper: 5 },
    machine:       { lower: 10, upper: 5 },
    cable:         { lower: 10, upper: 5 },
    kettlebell:    { lower: 9, upper: 9 },
    other:         { lower: 5, upper: 5 },
  },
} as const;

/** From HealthRules (system.md): MaxWeightIncreasePerSessionKg, MaxWeightIncreasePerWeekPercent. */
export const SafetyCaps = {
  MaxIncreaseKg: 5,
  MaxIncreasePct: 10,          // of W, applied per session
} as const;

export const PlateauRules = {
  WindowExposures: 3,          // last 3 non-deload exposures
  MinExposures: 4,             // needs ≥ 4 non-deload exposures
  IgnoreExposures: 2,          // "Ignorar"
  ResolvedQuietExposures: 3,   // "Bajar y reconstruir" / "Cambiar rango": no re-flag for 3 exposures
  ChangeRangeDays: 28,         // "Cambiar rango": 4 weeks
  StrengthRange: { min: 5, max: 8 },
  HypertrophyRange: { min: 8, max: 12 },
} as const;

export const DeloadRules = {
  WeeksWithPlateaus: 6,
  MinPlateaued: 3,
  MaxWeeks: 8,
  SetFactor: 0.6,              // sets = max(1, round(target × 0.6))
  WeightFactor: 0.9,
  DurationDays: 7,             // deload_until = today + 7
  SnoozeDays: 7,               // "Ahora no"
} as const;

export const ReadinessRules = {
  MinAnswer: 1,
  MaxAnswer: 5,
  GoodMin: 3.5,                // score ≥ 3.5 → good
  ModerateMin: 2.5,            // 2.5 ≤ score < 3.5 → moderate; < 2.5 → low
  SetReduction: 1,
  MinSets: 1,
  LowWeightFactor: 0.9,
} as const;

export const RecoveryRules = {
  LookbackDays: 7,
  BaseWindowH: 48,             // HealthRules.MinHoursBetweenSameMuscleGroup
  HeavyWindowH: 72,
  HeavySetsThreshold: 10,      // hard sets in the last session > 10 → 72 h
  SecondaryWeight: 0.5,
  RecoveringMinPct: 50,        // 100 fresh, 50–99 recovering, < 50 fatigued
  ExcludedMuscles: ['cardio', 'full_body', 'other'],
} as const;

export const SoftWarningRules = {
  MaxConsecutiveDays: 4,       // HealthRules.MaxConsecutiveTrainingDays
  MaxSetsPerMusclePerWeek: 20, // HealthRules.MaxSetsPerMusclePerWeek
} as const;

/** Same factor as LogSetUseCase (LBS_TO_KG). */
export const UnitFactors = { LbToKg: 0.453592 } as const;
```

> Decision: `HealthRules` exists only in [system.md](../../system.md), not in code (`src/lib/health-safety/` does not exist). The values the engine needs are copied into `SafetyCaps`, `RecoveryRules` and `SoftWarningRules`, each commented with the `HealthRules` key. Constant keys are PascalCase like the existing code (`WorkoutEntryRules.MinReps`).

### Pure functions

Every function is total (no throw) except `readinessScore`. Full precision internally; kg values are rounded to 2 decimals when converted back.

#### Units and loading

```ts
toDisplayWeight(kg: number, unit: WeightUnit): number    // lbs: round(kg / 0.453592, 1); kg: kg
fromDisplayWeight(v: number, unit: WeightUnit): number   // lbs: round(v × 0.453592, 2); kg: v

topWorkingWeight(sets: WorkingSet[]): number
  // most common weight across the sets; tie → the highest value

incrementFor(meta: ExerciseMeta, wKg: number, unit: WeightUnit): number   // display unit
  key  = meta.exerciseType === 'weighted_bodyweight' ? 'other'
       : meta.equipment ∈ {plate, band, other, bodyweight} ? 'other' : meta.equipment
  side = meta.muscleGroup ∈ LowerBodyMuscles ? 'lower' : 'upper'
  if unit = 'kg' and key = 'dumbbell' and side = 'upper' and wKg < 10 → 1.0
  return IncrementTable[unit][key][side]

roundToLoadable(valueDisplay: number, meta: ExerciseMeta, load: LoadContext, wKg: number): number   // display unit
  if meta.equipment === 'barbell':                  // ADR-021 §4: round DOWN to bar + k × (2 × smallest plate)
    bar  = toDisplayWeight(load.barWeightKg, unit)
    step = 2 × min(load.availablePlatesKg.map(p => toDisplayWeight(p, unit)))
    if valueDisplay ≤ bar → bar
    return bar + floor((valueDisplay − bar) / step + 1e-9) × step
  step = incrementFor(meta, wKg, unit)              // other equipment: NEAREST increment step
  return round(valueDisplay / step) × step

applySafetyCaps(wKg: number, proposedDisplay: number, stepDisplay: number, unit: WeightUnit): number
  capKg   = min(SafetyCaps.MaxIncreaseKg, wKg × SafetyCaps.MaxIncreasePct / 100)
  allowed = max(stepDisplay, toDisplayWeight(capKg, unit))      // minimum one increment step
  return min(proposedDisplay, toDisplayWeight(wKg, unit) + allowed)
```

> Decision: `topWorkingWeight` ties go to the higher weight (no Hevy/Gravl rule; simplest).
>
> Decision: only `barbell` uses plate rounding (ADR-021 §4 wording). `smith_machine` uses the nearest increment step.

#### `buildExposures` and `resolveRepRange`

```ts
buildExposures(rows: HistorySetRow[]): Exposure[]
  keep rows with setType ∈ WorkingSetTypes        // the port already returns completed sets of completed workouts
  group by workoutId → Exposure { workoutId, completedAt, isDeload, routineDayId, sets sorted by (position, setNumber) }
  drop groups with 0 sets
  return sorted by completedAt DESC                // newest first

resolveRepRange(override: ExerciseProgressionOverride | undefined,
                target: RoutineTarget | undefined, meta: ExerciseMeta, today: Date): RepRange
  if override?.repMin && override?.repMax && override.rangeUntil ≥ today → { min, max, source: 'override' }
  if target?.repMin && target?.repMax                                  → { min, max, source: 'routine' }
  meta.equipment ∈ CompoundBarbellEquipment → { 5, 8, 'default' } else { 8, 12, 'default' }
```

> Decision: when the same exercise appears twice in one workout (ADR-016 §1), both blocks form a single exposure.

#### `suggestNext` — decision table (ADR-021 §3)

`last = exposures[0]`, `W = topWorkingWeight(last.sets)`, `atW = last.sets.filter(s => s.weight === W)`, `best = max(reps of last.sets)`, `sets = targetSets ?? last.sets.length`, `r(s) = s.reps ?? 0`. Rows are evaluated top-down; the first match wins.

| # | Type | Condition | weight | reps | durationSeconds | reason |
|---|---|---|---|---|---|---|
| 0 | any | `exposures.length = 0` | → `null` (FR-PG-005 hint instead) | | | |
| 1 | `distance_duration`, `weight_distance` | always | → `null` (no hint) | | | |
| 2 | `duration` | always | `W` | `null` | `max(duration of last.sets) + 5` | `hold_progressing` |
| 3 | `assisted_bodyweight` | `W < 0` and every `atW` has `r ≥ max` | `min(0, W + step)` (one step of `incrementFor`) | `min` | `null` | `increase_all_sets_hit_max` |
| 4 | rep-only | every `atW` has `r ≥ max` | `W` | `max` | `null` | `increase_all_sets_hit_max` (explanation: add load) |
| 5 | rep-only | otherwise | `W` | `min(best + 1, max)` | `null` | `hold_progressing` |
| 6 | weight | every `atW` has `r ≥ max` **and** no `atW` has `rpe ≥ 9.5` | `increaseWeight(W)` | `min` | `null` | `increase_all_sets_hit_max` |
| 7 | weight | every `atW` has `r ≥ min` | `W` | `min(best + 1, max)` | `null` | `hold_progressing` |
| 8 | weight | some `atW` has `r < min` **and** `exposures[1]` exists with `topWorkingWeight = W` and one of its sets at `W` has `r < min` | `roundToLoadable(W × 0.9)` | `min` | `null` | `reduce_two_misses` |
| 9 | weight | some `atW` has `r < min` (first miss) | `W` | `min` | `null` | `hold_progressing` |

Every row also returns `sets`, `isDeload: false`, `readinessAdjusted: false`. "rep-only" = `bodyweight_reps`, `assisted_bodyweight`; "weight" = `weight_reps`, `weighted_bodyweight`.

```ts
increaseWeight(W, meta, load):                    // row 6
  step    = incrementFor(meta, W, unit)
  Wd      = toDisplayWeight(W, unit)
  capped  = applySafetyCaps(W, Wd + step, step, unit)
  rounded = roundToLoadable(capped, meta, load, W)
  if rounded ≤ Wd → return HOLD { weight: W, reps: max, reason: 'hold_progressing' }   // no loadable increase inside the cap
  return fromDisplayWeight(rounded, unit)
```

> Decision: when plate rounding cannot produce an increase inside the safety cap (e.g. smallest plate 2.5 kg on a light barbell lift), the suggestion holds the weight at `max` reps and the explanation suggests adding smaller plates. The cap is never exceeded (simplest safe option; neither Hevy nor Gravl documents it).
>
> Decision: in a free workout `sets` is the number of working sets of `last` (Hevy repeats the previous session).

#### Plateau (`plateau.ts`, ADR-021 §5)

```ts
detectPlateau(exerciseId, exposures: Exposure[], type: ExerciseType,
              override: ExerciseProgressionOverride | undefined): PlateauState
  nd     = exposures.filter(e => !e.isDeload)           // deloads excluded from the window
  metric = type ∈ WeightTypes ? 'e1rm' : type ∈ RepOnlyTypes ? 'reps' : null
  if metric = null or nd.length < MinExposures → plateaued = false
  value(e) = metric = 'e1rm' ? max(e1rm(s.weight, s.reps)) over sets with 1 ≤ reps ≤ 12   // e1rm() from progress/domain/personal-records.ts
           : max(s.reps)
  recent = nd[0 .. WindowExposures) ; before = nd[WindowExposures ..]
  bestRecent = max(value(recent))   ; bestBefore = max(value(before))
  plateaued  = bestBefore ≠ null and (bestRecent = null or bestRecent ≤ bestBefore)
  suppressed = isPlateauSuppressed(override, nd)

isPlateauSuppressed(override, ndExposures): boolean
  if !override or override.dismissedUntilExposures = null → false
  since = count of ndExposures with completedAt > override.updatedAt
  return since < override.dismissedUntilExposures

isRebuildActive(override, exposures): boolean       // GetSuggestions
  return override?.rebuildPending === true and no exposure has completedAt > override.updatedAt

alternateRange(current: RepRange): { min, max }       // "Cambiar rango"
  return current.max ≤ 8 ? HypertrophyRange : StrengthRange
```

> Decision: `dismissed_until_exposures` is read as "exposures completed after `updated_at`" (no decrement writes). "Ignorar" stores 2 (ADR-021); "Bajar y reconstruir" and "Cambiar rango" store 3 so the plateau does not re-flag until the window is refilled with the new plan. `rebuild_pending` becomes inert after the next exposure; it is not cleared on read.
>
> Decision: "Cambiar rango" from a non-standard range (e.g. 6–10) goes to 8–12 when `max ≤ 8`, else 5–8.

#### Deload (`deload.ts`, ADR-021 §6)

```ts
recommendDeload(input: {
  today: Date; deloadUntil: Date | null; lastDeloadAt: Date | null;
  programStartAt: Date | null; snoozedUntil: Date | null; plateauedExerciseIds: string[];
}): DeloadRecommendation
  if deloadUntil and today < deloadUntil → { status: 'active', activeUntil: deloadUntil, reason: null, … }
  anchor = lastDeloadAt ?? programStartAt          // programStartAt = first completed workout of the active program
  if !anchor → { status: 'none', weeksSinceLastDeload: null, … }
  weeks  = floor(daysBetween(anchor, today) / 7)
  reason = weeks ≥ MaxWeeks ? 'eight_weeks'
         : weeks ≥ WeeksWithPlateaus and plateauedExerciseIds.length ≥ MinPlateaued ? 'plateaus_after_6_weeks'
         : null
  if reason and snoozedUntil and today < snoozedUntil → status 'none'      // "Ahora no"
  return { status: reason ? 'recommended' : 'none', reason, weeksSinceLastDeload: weeks, plateauedExerciseIds, activeUntil: null }

applyDeload(base: Suggestion, last: Exposure, meta, range, load): Suggestion
  W = topWorkingWeight(last.sets)
  weight = meta.exerciseType ∈ WeightTypes ? fromDisplay(roundToLoadable(toDisplay(W) × 0.9, meta, load, W)) : W
  return { ...base,
    sets: max(1, round(base.sets × DeloadRules.SetFactor)),
    weight,
    reps: base.reps === null ? null : range.min,
    durationSeconds: base.durationSeconds === null ? null : max(duration of last.sets),   // no +5 s in a deload
    reason: 'deload', isDeload: true }
```

> Decision: the deload count uses `plateaued` and ignores `suppressed` (fatigue is program-wide; a per-exercise "Ignorar" does not hide it).

#### Readiness (`readiness.ts`, ADR-022 §1)

```ts
readinessScore(a: ReadinessAnswers): number      // throws InvalidReadinessAnswerError if an answer is not an integer 1..5
  return round((a.sleep + a.energy + a.soreness) / 3, 1)

readinessBand(score: number): ReadinessBand
  score ≥ 3.5 → 'good' ; score ≥ 2.5 → 'moderate' ; else 'low'

applyReadiness(s: Suggestion, score: number, meta, load): Suggestion
  band = readinessBand(score)
  if band = 'good' → s
  sets = max(MinSets, s.sets − SetReduction)
  if band = 'moderate' → { ...s, sets, readinessAdjusted: true }
  weight = meta.exerciseType ∈ WeightTypes ? roundToLoadable(s.weight × 0.9) (display ↔ kg as above) : s.weight
  return { ...s, sets, weight, readinessAdjusted: true,
           reason: s.reason === 'deload' ? 'deload' : 'readiness_low' }
```

> Decision: deload and low readiness stack (ADR-021: readiness applies after the progression output); `deload` keeps priority as the reason code. A moderate band keeps the original reason.

#### Recovery and warnings (`recovery.ts`, ADR-022 §2–3)

```ts
computeMuscleRecovery(rows: MuscleSetRow[], now: Date): MuscleRecovery[]
  rows = rows with completedAt ≥ now − LookbackDays
  for each muscle m (∉ ExcludedMuscles) present as primary or secondary:
    w(row)         = row.primaryMuscle = m ? 1.0 : SecondaryWeight
    weeklyHardSets = Σ w over rows involving m
    lastAt         = max completedAt over rows involving m ; lastWorkout = its workoutId
    sessionSets    = Σ w over rows of lastWorkout involving m
    windowHours    = sessionSets ≤ HeavySetsThreshold ? 48 : 72
    hoursSince     = (now − lastAt) / 3_600_000
    recoveryPct    = floor(min(100, hoursSince / windowHours × 100))
    state          = recoveryPct = 100 ? 'fresh' : recoveryPct ≥ 50 ? 'recovering' : 'fatigued'
  return sorted by recoveryPct ASC, then muscle

softWarnings(input: { trainingDayKeys: string[]; todayKey: string;
                      recovery: MuscleRecovery[]; routineMuscles: MuscleGroup[] }): SoftWarning[]
  streak      = consecutive local days with a completed workout ending YESTERDAY (todayKey − 1, − 2, …)
  dayOfStreak = streak + 1                         // today is (or would be) this training day
  if dayOfStreak ≥ MaxConsecutiveDays → { code: 'consecutive_days', consecutiveDays: dayOfStreak, muscles: [] }
  high = recovery.filter(r => r.weeklyHardSets > MaxSetsPerMusclePerWeek)
  if high.length → { code: 'high_volume', muscles: high.map(r => r.muscle), consecutiveDays: null }
  fatigued = routineMuscles ∩ recovery.filter(r => r.state = 'fatigued').map(r => r.muscle)
  if fatigued.length → { code: 'fatigued_muscle', muscles: fatigued, consecutiveDays: null }
```

> Decision: `cardio`, `full_body` and `other` are not on the recovery map (no body region; Hevy's muscle map has none). Working sets are `normal` + `failure`, the same definition as exposures.
>
> Decision: dismissing a soft warning (FR-PG-012) is stored client-side in `localStorage` under `gymup.warning.<code>.<todayKey>`. No table.

#### Explanations (`explain-suggestion.ts`, FR-PG-002 / FR-PG-005)

```ts
explainSuggestion(input: {
  suggestion: Suggestion; original: Suggestion | null; last: Exposure; previous: Exposure | null;
  range: RepRange; meta: ExerciseMeta; unit: WeightUnit; readinessScore: number | null;
}): string

firstTimeHint(range: RepRange): string
  → `Primera vez: elige un peso con el que llegues a ${min}–${max} reps con 2 en reserva`

formatWeight(kg, unit)       → "62.5 kg" | "140 lb"   (display unit, ≤ 1 decimal, trailing ".0" dropped)
formatRepsList([12, 12, 12]) → "12, 12 y 12"
```

Placeholders: `{reps}` = `formatRepsList(reps of last.sets at W)`, `{W}` = `formatWeight(W)`, `{new}` = `formatWeight(suggestion.weight)`, `{delta}` = `formatWeight(suggestion.weight − W)`, `{min}`/`{max}` = range, `{series}` = "1 serie" / "N series", `{score}` = readiness score with 1 decimal.

| Reason / variant | Template (es) |
|---|---|
| `increase_all_sets_hit_max` (weight types) | `La última vez hiciste {reps} reps con {W} (tope del rango {min}–{max}). Subimos {delta}.` |
| `increase_all_sets_hit_max` (`bodyweight_reps`, or assisted at 0) | `La última vez hiciste {reps} reps (tope del rango {min}–{max}). Prueba la versión con lastre.` |
| `increase_all_sets_hit_max` (`assisted_bodyweight`) | `La última vez hiciste {reps} reps con {W} de asistencia (tope del rango {min}–{max}). Reducimos la asistencia a {new}.` |
| `hold_progressing` (progressing) | `La última vez hiciste {reps} reps con {W}. Mantén el peso e intenta {suggestion.reps} reps.` |
| `hold_progressing` (RPE block) | `La última vez hiciste {reps} reps con {W}, pero una serie fue RPE {maxRpe}. Mantén el peso y repite {suggestion.reps} reps.` |
| `hold_progressing` (first miss) | `La última vez no llegaste a {min} reps en alguna serie con {W}. Mantén el peso y busca {min} reps.` |
| `hold_progressing` (no loadable increase) | `Llegaste al tope del rango con {W}, pero no hay un peso cargable dentro del límite de seguridad. Añade discos más pequeños en Ajustes para poder subir.` |
| `hold_progressing` (duration) | `La última vez aguantaste {dur} s. Intenta {suggestion.durationSeconds} s.` |
| `reduce_two_misses` | `Dos sesiones seguidas sin llegar a {min} reps con {W}. Bajamos a {new} para reconstruir.` |
| `plateau_rebuild` | `Elegiste bajar y reconstruir: {new} × {min}, y después volvemos a progresar.` |
| `deload` | `Semana de descarga: {series} con {new} × {min} para recuperar.` |
| `readiness_low` | `Tu check-in de hoy fue bajo ({score}/5). Sesión ligera: {series} con {new}.` |
| suffix when `readinessAdjusted` and band `moderate` | ` Ajustado por tu check-in: −1 serie.` |

### Worked examples (test cases)

Common context unless stated: unit `kg`, bar 20 kg, plates `[25,20,15,10,5,2.5,1.25]` (smallest 1.25 → bar step 2.5 kg), not a deload, no readiness score, no override. These rows are the table of `tests/progression/progression-engine.test.ts`.

| # | Exercise (equipment · primary · type) | Range · target sets | Last exposure (previous) | Context | Expected | Explanation |
|---|---|---|---|---|---|---|
| 1 | Bench Press (Barbell) · barbell · chest · weight_reps | routine 8–12 · 3 | 60×12, 60×12, 60×12 | — | `{ weight: 62.5, reps: 8, sets: 3, reason: 'increase_all_sets_hit_max', isDeload: false, readinessAdjusted: false }` | "La última vez hiciste 12, 12 y 12 reps con 60 kg (tope del rango 8–12). Subimos 2.5 kg." (FR-PG-002 verbatim) |
| 2 | Squat (Barbell) · barbell · quadriceps · weight_reps | default 5–8 (free workout) · null | 100×7, 100×6, 100×6 | — | `{ 100, reps: 8, sets: 3, 'hold_progressing' }` (best 7 + 1) | "La última vez hiciste 7, 6 y 6 reps con 100 kg. Mantén el peso e intenta 8 reps." |
| 3 | Leg Press (Machine) · machine · quadriceps · weight_reps | routine 8–12 · 3 | 140×7, 140×6, 140×6 (prev. 140×8, 140×7, 140×7) | — | `{ 125, reps: 8, sets: 3, 'reduce_two_misses' }` (126 → nearest 5) | "Dos sesiones seguidas sin llegar a 8 reps con 140 kg. Bajamos a 125 kg para reconstruir." |
| 4 | Lateral Raise (Dumbbell) · dumbbell · shoulders · weight_reps | routine 8–12 · 3 | 8×12, 8×12, 8×12 | — | `{ 9, reps: 8, sets: 3, 'increase_all_sets_hit_max' }` (step 1.0 because W < 10; 10 % cap = 0.8 kg, raised to one step) | "La última vez hiciste 12, 12 y 12 reps con 8 kg (tope del rango 8–12). Subimos 1 kg." |
| 5 | Barbell Row · barbell · upper_back · weight_reps | routine 8–12 · 3 | 60×12 @8, 60×12 @9, 60×12 @9.5 | RPE on | `{ 60, reps: 12, sets: 3, 'hold_progressing' }` (RPE 9.5 blocks Increase) | "La última vez hiciste 12, 12 y 12 reps con 60 kg, pero una serie fue RPE 9.5. Mantén el peso y repite 12 reps." |
| 6 | Bench Press (Barbell) · barbell · chest · weight_reps | routine 5–8 · 3 | 80×8, 80×8, 80×8 | `isDeload: true`, readiness (2,2,2) → 2.0 `low` | `original = { 70, reps: 5, sets: 2, 'deload', isDeload: true, readinessAdjusted: false }` (72 → round down 70); `suggestion = { 62.5, reps: 5, sets: 1, 'deload', isDeload: true, readinessAdjusted: true }` (63 → 62.5) | "Semana de descarga: 1 serie con 62.5 kg × 5 para recuperar." |

Additional cases for the same file:

| # | Case | Expected |
|---|---|---|
| 7 | Bench, unit `lbs`, bar 45 lb, plates lb `[45,35,25,10,5,2.5]`, last 135 lb × 12, 12, 12, range 8–12 | display 140 lb → stored `63.5` kg, reps 8, `increase_all_sets_hit_max` |
| 8 | Pull-up · bodyweight_reps · lats, last 0×10, 0×9, 0×8, range 8–12 | `{ 0, reps: 11, 'hold_progressing' }` |
| 9 | Plank · duration · abdominals, last 45 s, 45 s, 40 s | `{ weight: 0, reps: null, durationSeconds: 50, sets: 3, 'hold_progressing' }` |
| 10 | Any exercise with no exposure | `suggestion: null`, `firstTimeHint` "Primera vez: elige un peso con el que llegues a 8–12 reps con 2 en reserva" |
| 11 | Treadmill · distance_duration | `suggestion: null`, `firstTimeHint: null` |
| 12 | Row 1 with plates `[25,20,10,5,2.5]` (bar step 5) and W = 30 | 10 % cap = 3 kg → 32.5 → round down 30 ≤ W → `{ 30, reps: 12, 'hold_progressing' }`, "no loadable increase" text |
| 13 | Row 1 with override `rebuild_pending = true`, `updated_at` after the last exposure | 60 × 0.9 = 54 → round down → `{ 52.5, reps: 8, 'plateau_rebuild' }` |

Readiness: (4,4,3) → 3.7 `good`; (3,3,4) → 3.3 `moderate` (−1 set); (2,3,2) → 2.3 `low` (−1 set, × 0.9).

Recovery (now = Thu 18:00): chest last trained Tue 18:00 with 8.5 hard sets → 48 h window, 100 % `fresh`; quadriceps Wed 18:00 with 12 hard sets → 72 h window, 24 h → 33 % `fatigued`; biceps Wed 06:00 with 4 sets → 36 h / 48 h → 75 % `recovering`.

Deload: `last_deload_at` 2026-08-10, today 2026-10-01 → 7 weeks; 3 plateaued program exercises → `recommended` / `plateaus_after_6_weeks`; with 2 → `none`. `last_deload_at` 2026-08-01 → 8 weeks → `eight_weeks`.

### Entities

- `ExerciseProgressionOverride` — Drizzle row of `exercise_progression_overrides`. Identity `(userId, exerciseId)`. Owner-only.
- `ReadinessCheckin` — Drizzle row of `readiness_checkins`. Owner-only health data (same class as [ADR-023](../../decisions/023-body-metrics-privacy.md)).
- `ProgressionProfile` — read model of the progression columns of `profiles` (see `ProgressionProfilePort`).

### Value Objects

`Exposure`, `WorkingSet`, `RepRange`, `Suggestion`, `ReasonCode`, `PlateauState`, `DeloadRecommendation`, `ReadinessBand`, `MuscleRecovery`, `SoftWarning`. All derived, never stored.

### Invariants

- Suggestions are **advice**. A user can always log any value ([ADR-016 §5](../../decisions/016-workout-data-model-v2.md)); safety caps apply to suggestions only.
- Only completed sets of `status = 'completed'` workouts with `set_type ∈ {normal, failure}` (and `deleted_at IS NULL` after story 12.3) feed the engine.
- An increase never exceeds `min(5 kg, 10 % × W)` (at least one increment step), and a barbell suggestion is always loadable with the user's plates.
- Deload workouts never enter the plateau window; PRs still count in a deload ([ADR-020](../../decisions/020-personal-records.md)).
- Order of application: progression (`suggestNext` or rebuild) → deload (`applyDeload`) → readiness (`applyReadiness`).
- `progression_enabled = false` → every `ExerciseSuggestion` has `suggestion: null`, `firstTimeHint: null`, `plateaued: false`, and no deload card or plateau list is shown (FR-PG-013).
- `readiness_checkins` and `exercise_progression_overrides` are owner-only. `workouts.readiness_score` sits on a read-all row, but no sibling UI renders it ([ADR-022 Consequences](../../decisions/022-readiness-and-recovery.md)).
- "Today", `deload_until`, `range_until` and consecutive days are local dates in `profiles.timezone`, stored as `DATE` (`timestamp_ms` at UTC midnight of the local date in SQLite).

### Ports

| Port | File | Kind | Implemented by |
|---|---|---|---|
| `ProgressionHistoryPort` | `domain/ports/progression-history.port.ts` | required | `SqliteProgressionHistoryAdapter`, `SupabaseProgressionHistoryAdapter` — SQL over the workout tables (+ `routine_days`/`routine_exercises` ids for `findProgramExerciseIds`); no other context's repository is imported |
| `ExerciseCatalogPort` | exercise-library `domain/exercise-catalog.port.ts` | required (consumed) | `exerciseCatalogPort` from `exercise-library.composition.ts` — `findByIds(ids)` → `CatalogExercise` → `ExerciseMeta` |
| `RoutinePlanPort` | routines `domain/routine-plan.port.ts` | required (consumed) | `routinePlanPort` from `routines.composition.ts` — `findRoutinePlan(routineDayId)` → `RoutineTarget[]` |
| `ProgressionOverrideRepository` | `domain/progression-override.repository.ts` | required | `SqliteProgressionOverrideRepository`, `SupabaseProgressionOverrideRepository` |
| `ReadinessRepository` | `domain/readiness.repository.ts` | required | `SqliteReadinessRepository`, `SupabaseReadinessRepository` |
| `ProgressionProfilePort` | `domain/ports/progression-profile.port.ts` | required | `SqliteProgressionProfileAdapter`, `SupabaseProgressionProfileAdapter` (columns of `profiles`) |
| `SuggestionPort` | `domain/ports/suggestion.port.ts` | **provided** → workout-tracking (live workout SSR, start workout) | `ProgressionSuggestionService` |
| `ProgressionInsightsPort` | `domain/ports/progression-insights.port.ts` | **provided** → progress (`BuildWeeklyFactsUseCase`, [ADR-026](../../decisions/026-weekly-ai-coach-summary.md)) | `ProgressionInsightsService` |

Provided ports follow [contexts/readme.md → Cross-context ports](../readme.md#cross-context-ports-phase-2): declared and implemented here, exported as singletons from `progression.composition.ts`. Progression imports the pure `e1rm()` from `progress/domain/personal-records.ts` (shared kernel, no I/O). Tests use the providers' real SQLite adapters for the consumed ports (no mocks).

---

## Application

### Use Cases

Files `src/lib/contexts/progression/application/<verb-noun>.use-case.ts`. Every use case accepts `now?: Date` (default `new Date()`).

| Use case | Purpose | Story | Status |
|---|---|---|---|
| `GetSuggestionsUseCase` | `ExerciseSuggestion[]` for a set of exercises in a context (routine day, deload, readiness) | [10.2](../../../stories/phase-2/round-10/story-10.2.md) | planned |
| `ExplainSuggestionUseCase` | FR-PG-002 text for one exercise (detail page, re-opened sheet) | 10.2 | planned |
| `GetPlateausUseCase` | `PlateauState[]` (plateaued, not suppressed) for the active-program exercises or given ids | [10.3](../../../stories/phase-2/round-10/story-10.3.md) | planned |
| `ResolvePlateauUseCase` | Store the user's choice: `rebuild` · `change_range` · `ignore` | 10.3 | planned |
| `GetDeloadRecommendationUseCase` | `DeloadRecommendation` for the dashboard card and Settings | 10.3 | planned |
| `StartDeloadUseCase` | `deload_until = today + 7`, `last_deload_at = today`, `deload_snoozed_until = null` | 10.3 | planned |
| `SnoozeDeloadUseCase` | `deload_snoozed_until = today + 7` ("Ahora no") | 10.3 | planned |
| `EndDeloadUseCase` | `deload_until = null` ("Terminar descarga"); `last_deload_at` kept | 10.3 | planned |
| `SubmitReadinessUseCase` | Validate, score, upsert the check-in of the workout, copy the score to `workouts.readiness_score`, return adjusted suggestions | [10.4](../../../stories/phase-2/round-10/story-10.4.md) | planned |
| `GetMuscleRecoveryUseCase` | `MuscleRecovery[]` for the last 7 days | 10.4 | planned |
| `GetSoftWarningsUseCase` | `SoftWarning[]` for the dashboard, and for the readiness step when `routineDayId` is given | 10.4 | planned |

Application services for the provided ports: `ProgressionSuggestionService implements SuggestionPort` (delegates to `GetSuggestionsUseCase`; `isDeloadActive` reads the profile) and `ProgressionInsightsService implements ProgressionInsightsPort` (delegates to `GetPlateausUseCase`, `GetDeloadRecommendationUseCase`, `ReadinessRepository.listBetween`).

### Orchestration

1. **`GetSuggestionsUseCase.execute({ userId, exerciseIds, context }, now)`**
   1. `profile = ProgressionProfilePort.findProfile(userId)`. If `!profile.progressionEnabled`, return every item with `suggestion`, `original`, `explanation`, `firstTimeHint` = `null` and `plateaued: false`.
   2. In parallel: `exerciseCatalogPort.findByIds(exerciseIds)` → `ExerciseMeta`, `context.routineDayId ? routinePlanPort.findRoutinePlan(routineDayId) : undefined` → `RoutineTarget[]`, `overrides.findByExercises(userId, exerciseIds)`, `history.findCompletedSets(userId, exerciseIds)`.
   3. Per exercise: `exposures = buildExposures(rows)`; `range = resolveRepRange(override, target, meta, today)`.
   4. `base = isRebuildActive(override, exposures) ? rebuild : suggestNext(...)`, where rebuild = `{ weight: roundToLoadable(W × 0.9), reps: range.min, sets, reason: 'plateau_rebuild' }`.
   5. If `context.isDeload && base` → `applyDeload`. Keep the result as `original`.
   6. If `context.readinessScore != null && result` → `applyReadiness`.
   7. `plateau = detectPlateau(...)`; `plateaued = plateau.plateaued && !plateau.suppressed`.
   8. `explanation = explainSuggestion(...)`, or `firstTimeHint(range)` when there is no exposure and the type is not a distance type.
2. **`ExplainSuggestionUseCase.execute({ userId, exerciseId, workoutId? })`** → context from `history.findWorkoutContext` when `workoutId` is given (else free-workout context) → step 1 for one exercise → `{ explanation, suggestion, repRange }`.
3. **`GetPlateausUseCase.execute({ userId, exerciseIds?, includeSuppressed? })`** → ids default to `history.findProgramExerciseIds(profile.activeProgramId)`; loads sets and overrides; returns `detectPlateau` per exercise filtered to `plateaued && (includeSuppressed || !suppressed)`.
4. **`ResolvePlateauUseCase.execute({ userId, exerciseId, option })`**
   1. Recompute `detectPlateau`. If not `plateaued` → `ExerciseNotPlateauedError` (stale UI).
   2. `rebuild` → upsert `{ rebuildPending: true, dismissedUntilExposures: 3 }`.
   3. `change_range` → `current = resolveRepRange(override, target of input.routineDayId (optional, via RoutinePlanPort), meta, today)` → `alternateRange(current)` → upsert `{ repMin, repMax, rangeUntil: today + 28, dismissedUntilExposures: 3, rebuildPending: false }`.
   4. `ignore` → upsert `{ dismissedUntilExposures: 2 }` (an active range is kept).
   5. Every upsert sets `updatedAt = now`. Returns the override.
5. **`GetDeloadRecommendationUseCase.execute({ userId }, now)`** → profile (`status: 'none'` when progression is disabled); `programStartAt = history.findFirstProgramWorkoutAt(userId, activeProgramId)`; plateaued ids from `GetPlateausUseCase({ includeSuppressed: true })`; `recommendDeload(...)`.
6. **`StartDeloadUseCase` / `SnoozeDeloadUseCase` / `EndDeloadUseCase`** → `ProgressionProfilePort.updateDeloadState(userId, patch)`. Start is idempotent while a deload is active. A workout started while `today < deload_until` gets `is_deload = true`: workout-tracking's start use case calls `SuggestionPort.isDeloadActive(userId, now)`.
7. **`SubmitReadinessUseCase.execute({ userId, workoutId, sleep, energy, soreness }, now)`**
   1. `score = readinessScore(answers)` (`InvalidReadinessAnswerError` → 400).
   2. `ctx = history.findWorkoutContext(userId, workoutId)`; `undefined` → ownership error (403).
   3. `ReadinessRepository.upsertForWorkout({ userId, workoutId, sleep, energy, soreness, score })`: one check-in per workout (re-submit replaces) and `workouts.readiness_score = score`.
   4. Return `{ score, band: readinessBand(score), suggestions: GetSuggestions(ctx.exerciseIds, { ...ctx, readinessScore: score }) }`.
8. **`GetMuscleRecoveryUseCase.execute({ userId }, now)`** → `computeMuscleRecovery(history.findMuscleSets(userId, now − 7 d), now)`.
9. **`GetSoftWarningsUseCase.execute({ userId, routineDayId? }, now)`** → local day keys from `history.findTrainingDays(userId, now − 30 d)`, recovery from (8), `routineMuscles = routineDayId ? primary muscles of exerciseCatalogPort.findByIds(routinePlanPort.findRoutinePlan(routineDayId).exercises) : []` → `softWarnings(...)`.

> Decision: one readiness check-in per workout; re-submitting replaces it. *Saltar* writes nothing (`readiness_score` stays null). *Usar plan original* is client-only and does not clear the score.

---

## Infrastructure

Per [ADR-007](../../decisions/007-repository-pattern.md) and [ADR-011](../../decisions/011-implements-not-extends.md) (`implements`, never `extends`).

### Drizzle schema (`db/schema.ts`, story 10.2)

```ts
export const exerciseProgressionOverrides = sqliteTable('exercise_progression_overrides', {
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id').notNull().references(() => exercises.id),
  repMin: integer('rep_min'),
  repMax: integer('rep_max'),
  rangeUntil: integer('range_until', { mode: 'timestamp_ms' }),            // DATE
  dismissedUntilExposures: integer('dismissed_until_exposures'),
  rebuildPending: integer('rebuild_pending', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => [primaryKey({ columns: [t.userId, t.exerciseId] })]);
export type ExerciseProgressionOverride = typeof exerciseProgressionOverrides.$inferSelect;
export type NewExerciseProgressionOverride = typeof exerciseProgressionOverrides.$inferInsert;

export const readinessCheckins = sqliteTable('readiness_checkins', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  workoutId: text('workout_id').references(() => workouts.id, { onDelete: 'set null' }),
  sleep: integer('sleep').notNull(),
  energy: integer('energy').notNull(),
  soreness: integer('soreness').notNull(),
  score: real('score').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
export type ReadinessCheckin = typeof readinessCheckins.$inferSelect;
export type NewReadinessCheckin = typeof readinessCheckins.$inferInsert;

// profiles (007): deloadUntil, lastDeloadAt, deloadSnoozedUntil → integer(..., { mode: 'timestamp_ms' }) (DATE)
// profiles (004, story 7.1): progressionEnabled, readinessEnabled, barWeightKg, availablePlatesKg, timezone
```

Migrations: `supabase/migrations/007_progression.sql` + `db/migrations/0007_progression.sql` ([database-schema.md → 007](../../database-schema.md#007--progression-adr-021-adr-022)).

### Abstract Classes (Contracts)

```ts
// src/lib/contexts/progression/domain/ports/progression-history.port.ts
export interface HistorySetRow {
  workoutId: string; completedAt: Date; isDeload: boolean; routineDayId: string | null;
  exerciseId: string; position: number; setNumber: number; setType: SetType;
  weight: number; reps: number | null; durationSeconds: number | null; rpe: number | null;
}
export interface WorkoutContextRow { routineDayId: string | null; isDeload: boolean; readinessScore: number | null; exerciseIds: string[] }

export abstract class ProgressionHistoryPort {
  /** Completed sets of completed workouts of the user for these exercises; working set types only; deleted_at IS NULL. */
  abstract findCompletedSets(userId: string, exerciseIds: string[]): Promise<HistorySetRow[]>;
  abstract findProgramExerciseIds(programId: string): Promise<string[]>;         // distinct, non-archived routine days
  abstract findFirstProgramWorkoutAt(userId: string, programId: string): Promise<Date | undefined>;
  abstract findMuscleSets(userId: string, since: Date): Promise<MuscleSetRow[]>;
  abstract findTrainingDays(userId: string, since: Date): Promise<Date[]>;       // completed_at of completed workouts
  /** Owner-guarded: undefined when the workout does not belong to userId. */
  abstract findWorkoutContext(userId: string, workoutId: string): Promise<WorkoutContextRow | undefined>;
}

// src/lib/contexts/progression/domain/progression-override.repository.ts
export abstract class ProgressionOverrideRepository {
  abstract findByExercises(userId: string, exerciseIds: string[]): Promise<ExerciseProgressionOverride[]>;
  abstract upsert(input: NewExerciseProgressionOverride): Promise<ExerciseProgressionOverride>;   // PK (userId, exerciseId)
  abstract delete(userId: string, exerciseId: string): Promise<void>;
}

// src/lib/contexts/progression/domain/readiness.repository.ts
export abstract class ReadinessRepository {
  abstract findByWorkout(userId: string, workoutId: string): Promise<ReadinessCheckin | undefined>;
  /** Insert or replace the check-in of the workout and copy `score` to workouts.readiness_score (where user_id = userId). */
  abstract upsertForWorkout(input: NewReadinessCheckin & { userId: string; workoutId: string }): Promise<ReadinessCheckin>;
  abstract listBetween(userId: string, from: Date, to: Date): Promise<ReadinessCheckin[]>;
}

// src/lib/contexts/progression/domain/ports/progression-profile.port.ts
export interface ProgressionProfile {
  userId: string; weightUnit: WeightUnit; timezone: string;
  barWeightKg: number; availablePlatesKg: number[];
  progressionEnabled: boolean; readinessEnabled: boolean; activeProgramId: string | null;
  deloadUntil: Date | null; lastDeloadAt: Date | null; deloadSnoozedUntil: Date | null;
}
export type DeloadStatePatch = Partial<Pick<ProgressionProfile, 'deloadUntil' | 'lastDeloadAt' | 'deloadSnoozedUntil'>>;
export abstract class ProgressionProfilePort {
  abstract findProfile(userId: string): Promise<ProgressionProfile | undefined>;
  abstract updateDeloadState(userId: string, patch: DeloadStatePatch): Promise<ProgressionProfile>;   // write-own
}

// src/lib/contexts/progression/domain/ports/suggestion.port.ts — PROVIDED to workout-tracking
export abstract class SuggestionPort {
  abstract getSuggestions(userId: string, exerciseIds: string[], context: SuggestionContext, now?: Date): Promise<ExerciseSuggestion[]>;
  abstract isDeloadActive(userId: string, now?: Date): Promise<boolean>;
}

// src/lib/contexts/progression/domain/ports/progression-insights.port.ts — PROVIDED to progress
export abstract class ProgressionInsightsPort {
  abstract listPlateaus(userId: string, now?: Date): Promise<PlateauState[]>;          // plateaued && !suppressed
  abstract getDeloadStatus(userId: string, now?: Date): Promise<DeloadRecommendation>;
  abstract getReadinessAverage(userId: string, from: Date, to: Date): Promise<{ average: number | null; count: number }>;
}
```

### SQLite Implementation (tests, E2E, local)

- Files in `infrastructure/sqlite/`: `sqlite-progression-history.adapter.ts`, `sqlite-progression-override.repository.ts`, `sqlite-readiness.repository.ts`, `sqlite-progression-profile.adapter.ts`.
- Owner guard in code ([ADR-007](../../decisions/007-repository-pattern.md)): every override and check-in query has `where user_id = ?`; `upsertForWorkout` updates `workouts` with `where id = ? and user_id = ?` in the same transaction.
- `findCompletedSets`: `workout_entries we JOIN workout_exercises wx JOIN workouts w` with `w.user_id = ? AND w.status = 'completed' AND we.completed = 1 AND we.set_type IN ('normal','failure') AND we.exercise_id IN (…)`. Uses `idx_entries_exercise` and `idx_workouts_completed`.

### Supabase Implementation (production)

- Same files in `infrastructure/supabase/`. RLS: `progression_overrides_own` and `readiness_checkins_own` (`FOR ALL`, `auth.uid() = user_id`).
- `upsertForWorkout` runs two statements (upsert check-in, update `workouts.readiness_score`); the second is protected by `workouts_update_own`.
- History reads go through `workout_entries` with `workouts!inner(...)` filters, like Phase 1 `SupabaseProgressRepository`.

### Wiring (`progression.composition.ts`)

Per [ADR-010](../../decisions/010-per-context-composition.md); same `resolveStorageBackend()` / `buildXxx(backend)` pattern as `progress.composition.ts`.

```ts
// src/lib/contexts/progression/progression.composition.ts (excerpt)
import { exerciseCatalogPort } from '@/lib/contexts/exercise-library/exercise-library.composition';
import { routinePlanPort } from '@/lib/contexts/routines/routines.composition';

const backend = resolveStorageBackend();
const history = buildProgressionHistory(backend);        // SqliteProgressionHistoryAdapter(db) | SupabaseProgressionHistoryAdapter(getSupabaseClient())
const overrides = buildProgressionOverrideRepository(backend);
const readiness = buildReadinessRepository(backend);
const profilePort = buildProgressionProfile(backend);

export const getSuggestionsUseCase =
  new GetSuggestionsUseCase(history, overrides, profilePort, exerciseCatalogPort, routinePlanPort);
export const explainSuggestionUseCase = new ExplainSuggestionUseCase(getSuggestionsUseCase, history);
export const getPlateausUseCase = new GetPlateausUseCase(history, overrides, profilePort, exerciseCatalogPort);
export const resolvePlateauUseCase = new ResolvePlateauUseCase(history, overrides, profilePort, exerciseCatalogPort, routinePlanPort);
export const getDeloadRecommendationUseCase = new GetDeloadRecommendationUseCase(history, profilePort, getPlateausUseCase);
export const startDeloadUseCase = new StartDeloadUseCase(profilePort);
export const snoozeDeloadUseCase = new SnoozeDeloadUseCase(profilePort);
export const endDeloadUseCase = new EndDeloadUseCase(profilePort);
export const submitReadinessUseCase = new SubmitReadinessUseCase(readiness, history, getSuggestionsUseCase);
export const getMuscleRecoveryUseCase = new GetMuscleRecoveryUseCase(history);
export const getSoftWarningsUseCase =
  new GetSoftWarningsUseCase(history, profilePort, exerciseCatalogPort, routinePlanPort, getMuscleRecoveryUseCase);

// Provided ports
export const suggestionPort: SuggestionPort = new ProgressionSuggestionService(getSuggestionsUseCase, profilePort);
export const progressionInsightsPort: ProgressionInsightsPort =
  new ProgressionInsightsService(getPlateausUseCase, getDeloadRecommendationUseCase, readiness);
export const progressionBackend = backend;
```

---

## UI

### Components

Specs: [components.md → Progression](../../components.md#progression). Files kebab-case in `src/components/`.

| Component | File | Kind | Content |
|---|---|---|---|
| `SuggestionChip` | `suggestion-chip.tsx` | React (inside the live-workout island) | "Sugerido: 62.5 kg × 8" (plus "· 2 series" when sets differ from the routine), amber "Estancado" when `plateaued`, "Descarga" badge when `isDeload`, "Sugerencia sin conexión" when the payload came from the offline cache ([ADR-025 §6](../../decisions/025-offline-live-workout.md)); the FR-PG-005 hint when `suggestion = null` |
| `SuggestionWhySheet` | `suggestion-why-sheet.tsx` | React | Title "¿Por qué?", `explanation`, link "Opciones de estancamiento" when `plateaued` |
| `PlateauSheet` | `plateau-sheet.tsx` | React | **Bajar y reconstruir** (default), **Cambiar rango** (shows the new range), **Ignorar** |
| `DeloadCard` | `deload-card.astro` | Astro (form posts) | "Semana de descarga recomendada" + reason ("Llevas 7 semanas sin descarga y 3 ejercicios estancados" / "Llevas 8 semanas sin descarga"), **Empezar descarga** / **Ahora no** |
| `PlateauList` | `plateau-list.astro` | Astro | Dashboard "Ejercicios estancados" (when ≥ 1); each item links to `/exercises/[id]` |
| `ReadinessStep` | `readiness-step.tsx` | React (inside the live-workout island) | Three 1–5 sliders with the ADR-022 §1 labels, *Saltar*, the fatigued muscles hit by the routine and "Elegir otra rutina" |
| `ReadinessAdjustedHeader` | part of the live-workout header | React | "Sesión ajustada: −1 serie" (moderate) / "Hoy sesión ligera" (low) + *Usar plan original* |
| `RecoveryWidget` | `recovery-widget.tsx` | React island | Front/back silhouette heat map ≥ 400 px, list below (FR-PG-011); states "Recuperado" / "Recuperándose" / "Fatigado" |
| `SoftWarningBanner` | `soft-warning-banner.tsx` | React island | "Días seguidos" ("Hoy sería tu 4.º día seguido. Considera descansar."), "Volumen alto" ("Más de 20 series de {músculo} esta semana."), "Músculo fatigado" ("{músculo} aún se está recuperando."); dismissible |

### Interactive components (Astro islands)

- The live-workout island ([ADR-015](../../decisions/015-live-workout-react-island.md)) receives `ExerciseSuggestion[]` in its SSR props and renders `SuggestionChip`, `SuggestionWhySheet`, `PlateauSheet` and `ReadinessStep`. It never imports repositories; it calls the endpoints below.
- `ReadinessStep` computes `readinessScore` + `applyReadiness` client-side (bundled pure modules) for an instant update, then `POST /api/progression/readiness` and replaces the suggestions with the server response.
- `RecoveryWidget` and `SoftWarningBanner` hydrate with `client:visible` on `/dashboard`.

### Pages

| Page | Integration |
|---|---|
| `/dashboard` | SSR calls `getDeloadRecommendationUseCase` (→ `DeloadCard` when `recommended`; chip "Descarga activa hasta {fecha}" when `active`), `getPlateausUseCase` (→ `PlateauList`), `getMuscleRecoveryUseCase` (→ `RecoveryWidget`, and fatigued hints for the next-workout card, [FR-RT-012](../../../prd/features/routines.md)), `getSoftWarningsUseCase` (→ `SoftWarningBanner`). Deload card and plateau list are hidden when `progression_enabled = false`. |
| `/workout/[id]` | Workout-tracking's page loader calls `suggestionPort.getSuggestions(userId, exerciseIds, { routineDayId, isDeload, readinessScore })` → island props. `ReadinessStep` shows when `readiness_enabled`, the workout has no check-in and no set is completed yet. |
| `/exercises/[id]` | "Estancado" marker + *Opciones* (`PlateauSheet`) from `getPlateausUseCase({ exerciseIds: [id] })` (FR-PG-006). |
| `/settings` | "Descarga activa hasta {fecha}" + *Terminar descarga* (FR-PG-008). The `progression_enabled` / `readiness_enabled` toggles belong to the training settings form of story 9.4. |

### API endpoints

| Method | Path | Use case | Notes |
|---|---|---|---|
| GET | `/api/progression/suggestions?exerciseIds=a,b&workoutId=…` | `GetSuggestionsUseCase` | Exercise added mid-workout; context from `findWorkoutContext` (foreign workout → 403). JSON `ExerciseSuggestion[]` |
| GET | `/api/progression/suggestions/[exerciseId]/explanation?workoutId=…` | `ExplainSuggestionUseCase` | `{ explanation, suggestion, repRange }` |
| GET | `/api/progression/plateaus?exerciseIds=…` | `GetPlateausUseCase` | `PlateauState[]` |
| POST | `/api/progression/plateaus/[exerciseId]` | `ResolvePlateauUseCase` | JSON `{ option: 'rebuild' \| 'change_range' \| 'ignore', routineDayId? }` → 200 override; 400 unknown option; 409 not plateaued |
| POST | `/api/progression/deload/start` | `StartDeloadUseCase` | Form → 303 `/dashboard` |
| POST | `/api/progression/deload/snooze` | `SnoozeDeloadUseCase` | Form → 303 `/dashboard` |
| POST | `/api/progression/deload/end` | `EndDeloadUseCase` | Form → 303 `/settings` |
| POST | `/api/progression/readiness` | `SubmitReadinessUseCase` | JSON `{ workoutId, sleep, energy, soreness }` → `{ score, band, suggestions }`; 400 invalid; 403 foreign workout |
| GET | `/api/progression/recovery` | `GetMuscleRecoveryUseCase` | `MuscleRecovery[]` |
| GET | `/api/progression/warnings?routineDayId=…` | `GetSoftWarningsUseCase` | `SoftWarning[]` |

All endpoints return 401 without a session (Phase 1 `getSessionIdFromRequest` + `getAuthService().getCurrentUser`) and take the user id from the session only.

---

## Testing

Per [ADR-009](../../decisions/009-object-mothers.md): no mocks, real SQLite, Object Mothers. Pure modules get exhaustive table-driven tests.

| File | What |
|---|---|
| `tests/progression/progression-engine.test.ts` | Decision-table rows 0–9, worked examples 1–13, every increment (equipment × side × unit), `roundToLoadable`, `applySafetyCaps`, `topWorkingWeight` ties |
| `tests/progression/plateau.test.ts` | < 4 exposures, deload excluded, equal best = plateau, improvement = not, rep-only metric, suppression counts (2 / 3), `alternateRange` |
| `tests/progression/deload.test.ts` | `recommendDeload` (6 w + 3, 6 w + 2, 8 w, active, snoozed, no anchor); `applyDeload` set rounding (2→1, 3→2, 4→2, 5→3) |
| `tests/progression/readiness.test.ts` | Score rounding, band boundaries 2.5 / 3.5, minimum 1 set, stacking with deload |
| `tests/progression/recovery.test.ts` | 48 / 72 h windows (10 vs 10.5 sets), secondary 0.5, state boundaries 50 / 100, 7-day lookback, excluded muscles; `softWarnings` 3 vs 4 days, > 20 sets |
| `tests/progression/explain-suggestion.test.ts` | One assertion per template row; FR-PG-002 sentence verbatim |
| `tests/progression/get-suggestions.use-case.test.ts` | Real SQLite: free vs routine range, override range, rebuild, deload + readiness, progression disabled |
| `tests/progression/resolve-plateau.use-case.test.ts`, `deload-use-cases.test.ts`, `submit-readiness.use-case.test.ts` | Persistence, `workouts.readiness_score` copy, owner guard |
| `tests/supabase/rls-progression.integration.test.ts` | As a **non-owner**: cannot select, insert or update another user's `exercise_progression_overrides` and `readiness_checkins` |

Mothers (`tests/progression/mothers/`): `ExposureMother` (`.sets(weight, reps[], { rpe?, daysAgo?, isDeload? })`), `ExerciseMetaMother` (`.barbellChest()`, `.barbellSquat()`, `.machineLegPress()`, `.dumbbellShoulders()`, `.pullUp()`, `.plank()`, `.treadmill()`), `LoadContextMother` (`.kgDefault()`, `.lbsDefault()`), `ProgressionOverrideMother`. `tests/progression/test-db.ts` re-exports the workout-tracking harness (same pattern as `tests/progress/test-db.ts`).

```ts
// tests/progression/progression-engine.test.ts
import { describe, it, expect } from 'vitest';
import { suggestNext } from '@/lib/contexts/progression/domain/progression-engine';
import { ExposureMother } from './mothers/exposure.mother';
import { ExerciseMetaMother } from './mothers/exercise-meta.mother';
import { LoadContextMother } from './mothers/load-context.mother';

describe('suggestNext — worked examples', () => {
  it.each([
    { name: '1 increase barbell', meta: ExerciseMetaMother.barbellChest(), range: { min: 8, max: 12, source: 'routine' as const },
      targetSets: 3, exposures: [ExposureMother.sets(60, [12, 12, 12])],
      expected: { weight: 62.5, reps: 8, sets: 3, reason: 'increase_all_sets_hit_max' } },
    { name: '3 reduce two misses', meta: ExerciseMetaMother.machineLegPress(), range: { min: 8, max: 12, source: 'routine' as const },
      targetSets: 3, exposures: [ExposureMother.sets(140, [7, 6, 6]), ExposureMother.sets(140, [8, 7, 7], { daysAgo: 4 })],
      expected: { weight: 125, reps: 8, sets: 3, reason: 'reduce_two_misses' } },
  ])('$name', ({ meta, range, targetSets, exposures, expected }) => {
    const s = suggestNext({ exposures, meta, range, targetSets, load: LoadContextMother.kgDefault() });
    expect(s).toMatchObject({ ...expected, isDeload: false, readinessAdjusted: false });
  });
});
```

---

## Flows

- [suggest-next-load.flow.md](./flows/suggest-next-load.flow.md)
- [plateau-and-deload.flow.md](./flows/plateau-and-deload.flow.md)
- [readiness-check-in.flow.md](./flows/readiness-check-in.flow.md)
