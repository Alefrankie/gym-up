// src/lib/contexts/public-view/application/calculate-member-stats.use-case.ts
//
// Use case: compute stats (totalWorkouts, currentStreak, lastWorkout)
// for a single family member.
//
// Internally delegates streak calculation to the existing
// CalculateStreakUseCase from the progress context (reuse, no duplication).
// Uses PublicWorkoutRepository for totalWorkouts + lastWorkout.

import type { MemberStats } from '../domain/member';
import type { CalculateMemberStatsInput } from '../domain/member';
import type { PublicWorkoutRepository } from '../domain/public-workout.repository';
import { CalculateStreakUseCase } from '@/lib/contexts/progress/application/calculate-streak.use-case';

export class CalculateMemberStatsUseCase {
  constructor(
    private readonly workoutRepo: PublicWorkoutRepository,
    private readonly streakUseCase: CalculateStreakUseCase,
  ) {}

  async execute(input: CalculateMemberStatsInput): Promise<MemberStats> {
    const [totalWorkouts, streak, lastWorkout] = await Promise.all([
      this.workoutRepo.getCompletedCount(input.userId),
      this.streakUseCase.execute({ userId: input.userId }),
      this.workoutRepo.getLastWorkoutDate(input.userId),
    ]);

    return {
      totalWorkouts,
      currentStreak: streak.current,
      lastWorkout,
    };
  }
}
