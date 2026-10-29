// src/lib/contexts/progress/application/get-exercise-list.use-case.ts
//
// Use case: fetch the distinct exercises the user has logged in completed
// workouts (populates the exercise selector dropdown).
//
// Per architecture readme: "Exercise selector shows ONLY exercises the
// user has actually logged." This use case enforces that contract.

import type { Exercise } from '@db/schema';
import { type ExerciseQueryRepository } from '../domain/ports/ExerciseQueryRepository';
import type { GetExerciseListInput } from '../domain/progress.types';

export class GetExerciseListUseCase {
  constructor(
    private readonly exerciseQueryRepository: ExerciseQueryRepository,
  ) {}

  async execute(input: GetExerciseListInput): Promise<Exercise[]> {
    return this.exerciseQueryRepository.getLoggedExercises(input.userId);
  }
}
