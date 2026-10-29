// src/lib/contexts/public-view/application/get-member-detail-use-case.ts
//
// Use case: fetch full profile detail for /family/[user_id].
// Per public-view/readme.md: GetMemberWorkoutsUseCase + stats.
//
// Returns MemberProfile with workouts[] for calendar + streak rendering.
// Photos are NEVER included (ADR-005).

import type { MemberProfile } from '../domain/member';
import type { PublicProfileRepository } from '../domain/public-profile.repository';
import type { PublicWorkoutRepository } from '../domain/public-workout.repository';
import { CalculateMemberStatsUseCase } from './calculate-member-stats.use-case';

export class GetMemberDetailUseCase {
  constructor(
    private readonly profileRepo: PublicProfileRepository,
    private readonly workoutRepo: PublicWorkoutRepository,
    private readonly statsUseCase: CalculateMemberStatsUseCase,
  ) {}

  async execute(memberId: string): Promise<MemberProfile | undefined> {
    const profile = await this.profileRepo.getById(memberId);
    if (!profile) return undefined;

    const [stats, workouts] = await Promise.all([
      this.statsUseCase.execute({ userId: profile.id }),
      this.workoutRepo.getCompletedByUserId(profile.id),
    ]);

    return {
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        routineType: profile.routineType,
        totalWorkouts: stats.totalWorkouts,
        currentStreak: stats.currentStreak,
        lastWorkout: stats.lastWorkout,
      },
      workouts: workouts.map((w) => ({
        id: w.id,
        workoutDate: w.workoutDate.toISOString().split('T')[0],
      })),
      stats,
    };
  }
}
