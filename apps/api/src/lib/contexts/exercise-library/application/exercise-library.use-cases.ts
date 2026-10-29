import type { Exercise } from '@db/schema';
import {
  ExerciseNameTakenError,
  ExerciseNotFoundError,
  ExerciseOwnershipError,
  type ExerciseFilter,
  type ExerciseLibraryRepository,
  type ExercisePatch,
} from '../domain/exercise-library.repository';

export interface CustomExerciseInput {
  name: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  equipment: string;
  exerciseType: string;
  instructions?: string | null;
  videoUrl?: string | null;
}

/** Names are unique across system and custom exercises, case-insensitively (the table keeps `name` UNIQUE). */
async function assertNameFree(repo: ExerciseLibraryRepository, name: string, exceptId?: string): Promise<void> {
  const clash = await repo.findByName(name);
  if (clash && clash.id !== exceptId) throw new ExerciseNameTakenError(name);
}

export class ListExercisesUseCase {
  constructor(private readonly repo: ExerciseLibraryRepository) {}
  execute(filter: ExerciseFilter): Promise<Exercise[]> {
    return this.repo.list(filter);
  }
}

export class GetExerciseUseCase {
  constructor(private readonly repo: ExerciseLibraryRepository) {}
  async execute(id: string): Promise<Exercise> {
    const row = await this.repo.findById(id);
    if (!row) throw new ExerciseNotFoundError(id);
    return row;
  }
}

export class CreateCustomExerciseUseCase {
  constructor(private readonly repo: ExerciseLibraryRepository) {}
  async execute(userId: string, id: string, input: CustomExerciseInput): Promise<Exercise> {
    // Replaying an offline create (ADR-025): same id and owner returns the stored row.
    const existing = await this.repo.findById(id);
    if (existing) {
      if (existing.ownerId !== userId) throw new ExerciseOwnershipError();
      return existing;
    }
    await assertNameFree(this.repo, input.name);
    return this.repo.create({
      id,
      ownerId: userId,
      name: input.name,
      muscleGroup: input.muscleGroup,
      secondaryMuscles: input.secondaryMuscles,
      equipment: input.equipment,
      exerciseType: input.exerciseType,
      instructions: input.instructions ?? null,
      videoUrl: input.videoUrl ?? null,
    });
  }
}

export class UpdateCustomExerciseUseCase {
  constructor(private readonly repo: ExerciseLibraryRepository) {}
  async execute(userId: string, id: string, patch: ExercisePatch): Promise<Exercise> {
    const row = await this.repo.findById(id);
    if (!row) throw new ExerciseNotFoundError(id);
    if (row.ownerId !== userId) throw new ExerciseOwnershipError();
    if (patch.name !== undefined) await assertNameFree(this.repo, patch.name, id);
    return this.repo.update(id, patch);
  }
}

/** Custom exercises are never hard-deleted: workouts and routines keep referencing them (ADR-017). */
export class ArchiveCustomExerciseUseCase {
  constructor(private readonly repo: ExerciseLibraryRepository) {}
  async execute(userId: string, id: string): Promise<void> {
    const row = await this.repo.findById(id);
    if (!row) throw new ExerciseNotFoundError(id);
    if (row.ownerId !== userId) throw new ExerciseOwnershipError();
    await this.repo.update(id, { isArchived: true });
  }
}
