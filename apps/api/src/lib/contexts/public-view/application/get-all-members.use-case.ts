// src/lib/contexts/public-view/application/get-all-members.use-case.ts
//
// Use case: fetch all family members with computed stats.
// Per public-view/readme.md: GetAllProfilesUseCase.
//
// Orchestrates:
// 1. PublicProfileRepository.getAll() → get all profiles
// 2. CalculateMemberStatsUseCase per profile → compute stats
// 3. Return MemberCard[] (email omitted per FR-PV-003)

import type { MemberCard } from '../domain/member';
import type { PublicProfileRepository } from '../domain/public-profile.repository';
import { CalculateMemberStatsUseCase } from './calculate-member-stats.use-case';

export class GetAllMembersUseCase {
  constructor(
    private readonly profileRepo: PublicProfileRepository,
    private readonly statsUseCase: CalculateMemberStatsUseCase,
  ) {}

  /** `onlyIds` restricts the list to those members (a group's roster). */
  async execute(onlyIds?: readonly string[]): Promise<MemberCard[]> {
    const all = await this.profileRepo.getAll();
    const profiles = onlyIds ? all.filter((p) => onlyIds.includes(p.id)) : all;

    const memberCards = await Promise.all(
      profiles.map(async (profile) => {
        const stats = await this.statsUseCase.execute({
          userId: profile.id,
        });
        return {
          id: profile.id,
          displayName: profile.displayName,
          routineType: profile.routineType,
          totalWorkouts: stats.totalWorkouts,
          currentStreak: stats.currentStreak,
          lastWorkout: stats.lastWorkout,
        };
      }),
    );

    return memberCards;
  }
}
