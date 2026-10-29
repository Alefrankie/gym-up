import type { Exercise } from '@db/schema';

export interface ExerciseFilter {
  q?: string;
  muscle?: string;
  equipment?: string;
  /** Only the caller's own custom exercises (archived ones included). */
  mine?: boolean;
  userId: string;
}

export interface NewCustomExercise {
  id: string;
  ownerId: string;
  name: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  equipment: string;
  exerciseType: string;
  instructions: string | null;
  videoUrl: string | null;
}

export type ExercisePatch = Partial<Omit<NewCustomExercise, 'id' | 'ownerId'>> & { isArchived?: boolean };

export class ExerciseNotFoundError extends Error {
  constructor(id: string) {
    super(`Exercise not found: ${id}`);
    this.name = 'ExerciseNotFoundError';
  }
}

export class ExerciseOwnershipError extends Error {
  constructor() {
    super('Only the owner can change this exercise');
    this.name = 'ExerciseOwnershipError';
  }
}

export class ExerciseNameTakenError extends Error {
  constructor(name: string) {
    super(`An exercise named "${name}" already exists`);
    this.name = 'ExerciseNameTakenError';
  }
}

export abstract class ExerciseLibraryRepository {
  abstract list(filter: ExerciseFilter): Promise<Exercise[]>;
  abstract findById(id: string): Promise<Exercise | undefined>;
  abstract findByName(name: string): Promise<Exercise | undefined>;
  abstract create(input: NewCustomExercise): Promise<Exercise>;
  abstract update(id: string, patch: ExercisePatch): Promise<Exercise>;
}
