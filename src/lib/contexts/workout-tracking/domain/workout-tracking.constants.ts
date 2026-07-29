// src/lib/contexts/workout-tracking/domain/workout-tracking.constants.ts
//
// Domain constants for the workout-tracking context.
// Per the parent spec (docs/architecture/contexts/workout-tracking/readme.md).

export const WorkoutStatuses = {
  InProgress: 'in_progress',
  Completed: 'completed',
} as const;
export type WorkoutStatus = (typeof WorkoutStatuses)[keyof typeof WorkoutStatuses];

export const RoutineTypes = {
  Hombre: 'hombre',
  Mujer: 'mujer',
} as const;
export type RoutineType = (typeof RoutineTypes)[keyof typeof RoutineTypes];

export const Weekdays = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
} as const;
export type Weekday = (typeof Weekdays)[keyof typeof Weekdays];

export const WorkoutEntryRules = {
  MinReps: 1,
  MaxReps: 100,
  MinWeight: 0, // kg
  MaxWeight: 500, // kg
  MaxNotesLength: 500,
  DefaultRestSeconds: 90,
  MinRestSeconds: 30, // safety: avoid overtraining
  MaxRestSeconds: 600, // 10 min upper bound
  MaxSetsPerExercise: 10,
} as const;

export const WorkoutSessionRules = {
  MinDurationMinutes: 15, // safety: no rushed workouts
  MaxDurationMinutes: 180, // 3 hours upper bound
  MinExercises: 3, // quality threshold
  MaxExercises: 15,
  MinCompletedEntries: 1, // to mark completed
  MinWarmupSeconds: 300, // 5 min warmup recommended
  MinCooldownSeconds: 900, // 15 min cooldown recommended
} as const;

export const TrainingFrequencyRules = {
  MinRestDaysPerWeek: 1, // at least 1 rest day
  MaxConsecutiveDays: 4, // avoid overtraining
  MinWeeksBetweenSameMuscle: 0, // same muscle can be trained on different days
  MaxVolumePerMusclePerWeek: 20, // sets per muscle per week
} as const;

export const CardioRules = {
  MinWarmupMinutes: 5,
  MaxWarmupMinutes: 15,
  MinCooldownMinutes: 15,
  MaxCooldownMinutes: 30,
  RecommendedMinPerDay: 20, // cardio daily target
} as const;
