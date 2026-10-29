// src/lib/contexts/workout-tracking/application/log-set.use-case.ts
//
// Use case: log a set (create or update).
//
// Per docs/architecture/contexts/workout-tracking/readme.md Use Cases table
// (LogSetUseCase — was "planned", now implemented for story 2.4).
// Per docs/architecture/contexts/workout-tracking/flows/log-set.flow.md
// (Steps 2-3: user logs set → auto-save inserts/updates workout_entries).
//
// Returns a discriminated union so the caller can distinguish a freshly
// created entry from an updated one (useful for telemetry, UI feedback,
// and the auto-save module's onSuccess hook).
//
// Idempotency: if an entry already exists for (workoutId, exerciseId,
// setNumber), it is UPDATED. This enforces "one entry per set" at the
// application layer (per the parent spec invariant). The schema has no
// DB-level unique constraint on these columns (intentional, per the
// 2.2 decision — app-layer enforcement is the chosen pattern).
//
// Weight conversion (AC-2.4-08): the user types in their unit (kg or lbs).
// The use case converts to kg before persisting, per ADR-006.

import {
  WorkoutOwnershipError,
  type WorkoutRepository,
} from '../domain/workout.repository';
import { WorkoutEntryRules } from '../domain/workout-tracking.constants';
import type { WorkoutEntry } from '@db/schema';

export interface LogSetInput {
  userId: string;
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weight: number;
  weightUnit: 'kg' | 'lbs';
  completed: boolean;
  notes: string | null;
}

export type LogSetResult =
  | { kind: 'created'; entry: WorkoutEntry }
  | { kind: 'updated'; entry: WorkoutEntry };

/**
 * Thrown when the input fails one of the validation rules
 * (WorkoutEntryRules.MinReps/MaxReps, MinWeight/MaxWeight,
 * MaxSetsPerExercise, MaxNotesLength).
 */
export class LogSetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LogSetValidationError';
  }
}

/**
 * Thrown when the workoutId does not correspond to any workout in the
 * database. The endpoint maps this to HTTP 404.
 */
export class WorkoutNotFoundError extends Error {
  constructor(public readonly workoutId: string) {
    super(`Workout not found: ${workoutId}`);
    this.name = 'WorkoutNotFoundError';
  }
}

// Conversion factor: 1 lb = 0.453592 kg (per ADR-006).
const LBS_TO_KG = 0.453592;

export class LogSetUseCase {
  constructor(private readonly workoutRepository: WorkoutRepository) {}

  async execute(input: LogSetInput): Promise<LogSetResult> {
    // 1. Validate inputs.
    this.validate(input);

    // 2. Verify workout ownership.
    const workout = await this.workoutRepository.findById(input.workoutId);
    if (!workout) {
      throw new WorkoutNotFoundError(input.workoutId);
    }
    if (workout.userId !== input.userId) {
      throw new WorkoutOwnershipError(input.workoutId, input.userId);
    }

    // 3. Convert weight to kg if user is on lbs.
    const weightKg =
      input.weightUnit === 'lbs' ? input.weight * LBS_TO_KG : input.weight;

    // 4. Find existing entry for (workoutId, exerciseId, setNumber).
    const allEntries = await this.workoutRepository.findEntries(input.workoutId);
    const existing = allEntries.find(
      (e) => e.exerciseId === input.exerciseId && e.setNumber === input.setNumber,
    );

    // 5. Update or create.
    if (existing) {
      const updated = await this.workoutRepository.updateEntry(
        existing.id,
        {
          reps: input.reps,
          weight: weightKg,
          completed: input.completed,
          notes: input.notes,
        },
        input.userId,
      );
      return { kind: 'updated', entry: updated };
    } else {
      const created = await this.workoutRepository.addEntry(
        input.workoutId,
        {
          exerciseId: input.exerciseId,
          setNumber: input.setNumber,
          reps: input.reps,
          weight: weightKg,
          completed: input.completed,
          notes: input.notes,
        },
        input.userId,
      );
      return { kind: 'created', entry: created };
    }
  }

  private validate(input: LogSetInput): void {
    if (
      !Number.isInteger(input.setNumber) ||
      input.setNumber < 1 ||
      input.setNumber > WorkoutEntryRules.MaxSetsPerExercise
    ) {
      throw new LogSetValidationError(
        `setNumber out of range: ${input.setNumber} (must be 1..${WorkoutEntryRules.MaxSetsPerExercise})`,
      );
    }
    if (
      !Number.isInteger(input.reps) ||
      input.reps < WorkoutEntryRules.MinReps ||
      input.reps > WorkoutEntryRules.MaxReps
    ) {
      throw new LogSetValidationError(
        `reps out of range: ${input.reps} (must be ${WorkoutEntryRules.MinReps}..${WorkoutEntryRules.MaxReps})`,
      );
    }
    if (
      input.weight < WorkoutEntryRules.MinWeight ||
      input.weight > WorkoutEntryRules.MaxWeight
    ) {
      throw new LogSetValidationError(
        `weight out of range: ${input.weight} (must be ${WorkoutEntryRules.MinWeight}..${WorkoutEntryRules.MaxWeight})`,
      );
    }
    if (input.notes !== null && input.notes.length > WorkoutEntryRules.MaxNotesLength) {
      throw new LogSetValidationError(
        `notes too long: ${input.notes.length} (max ${WorkoutEntryRules.MaxNotesLength})`,
      );
    }
  }
}
