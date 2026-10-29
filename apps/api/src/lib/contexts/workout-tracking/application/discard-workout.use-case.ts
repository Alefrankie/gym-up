// Use case: cancel a workout that is still in progress (all its sets go with it).
//
// Idempotent: discarding a workout that no longer exists succeeds, so an offline client can replay the command.
// A finished workout is history and cannot be discarded.

import { WorkoutOwnershipError, type WorkoutRepository } from '../domain/workout.repository';

export class WorkoutAlreadyCompletedError extends Error {
  constructor(public readonly workoutId: string) {
    super('A finished workout cannot be cancelled');
    this.name = 'WorkoutAlreadyCompletedError';
  }
}

export class DiscardWorkoutUseCase {
  constructor(private readonly workouts: WorkoutRepository) {}

  async execute(input: { userId: string; workoutId: string }): Promise<void> {
    const workout = await this.workouts.findById(input.workoutId);
    if (!workout) return;
    if (workout.userId !== input.userId) throw new WorkoutOwnershipError(input.workoutId, input.userId);
    if (workout.status === 'completed') throw new WorkoutAlreadyCompletedError(input.workoutId);
    await this.workouts.delete(input.workoutId, input.userId);
  }
}
