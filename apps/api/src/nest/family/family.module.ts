import { Module } from '@nestjs/common';
import type { Db } from '@/lib/db/client';
import { CalculateStreakUseCase } from '@/lib/contexts/progress/application/calculate-streak.use-case';
import { CalculateMemberStatsUseCase } from '@/lib/contexts/public-view/application/calculate-member-stats.use-case';
import { GetAllMembersUseCase } from '@/lib/contexts/public-view/application/get-all-members.use-case';
import { GetMemberDetailUseCase } from '@/lib/contexts/public-view/application/get-member-detail-use-case';
import { PublicProfileRepository } from '@/lib/contexts/public-view/domain/public-profile.repository';
import { PublicWorkoutRepository } from '@/lib/contexts/public-view/domain/public-workout.repository';
import { SqlitePublicProfileRepository } from '@/lib/contexts/public-view/infrastructure/sqlite/sqlite-public-profile.repository';
import { SqlitePublicWorkoutRepository } from '@/lib/contexts/public-view/infrastructure/sqlite/sqlite-public-workout.repository';
import { DB } from '../tokens';
import { ProgressModule } from '../progress/progress.module';
import { FamilyController } from './family.controller';

@Module({
  imports: [ProgressModule],
  controllers: [FamilyController],
  providers: [
    { provide: PublicProfileRepository, useFactory: (db: Db) => new SqlitePublicProfileRepository(db), inject: [DB] },
    { provide: PublicWorkoutRepository, useFactory: (db: Db) => new SqlitePublicWorkoutRepository(db), inject: [DB] },
    {
      provide: CalculateMemberStatsUseCase,
      useFactory: (w: PublicWorkoutRepository, s: CalculateStreakUseCase) => new CalculateMemberStatsUseCase(w, s),
      inject: [PublicWorkoutRepository, CalculateStreakUseCase],
    },
    {
      provide: GetAllMembersUseCase,
      useFactory: (p: PublicProfileRepository, s: CalculateMemberStatsUseCase) => new GetAllMembersUseCase(p, s),
      inject: [PublicProfileRepository, CalculateMemberStatsUseCase],
    },
    {
      provide: GetMemberDetailUseCase,
      useFactory: (p: PublicProfileRepository, w: PublicWorkoutRepository, s: CalculateMemberStatsUseCase) =>
        new GetMemberDetailUseCase(p, w, s),
      inject: [PublicProfileRepository, PublicWorkoutRepository, CalculateMemberStatsUseCase],
    },
  ],
})
export class FamilyModule {}
