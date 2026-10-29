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
import { GroupsController } from './groups.controller';
import {
  CanViewMemberUseCase,
  CreateGroupUseCase,
  GetGroupUseCase,
  JoinGroupUseCase,
  LeaveGroupUseCase,
  ListGroupsUseCase,
} from '@/lib/contexts/groups/application/group.use-cases';
import { GroupRepository } from '@/lib/contexts/groups/domain/group.repository';
import { SqliteGroupRepository } from '@/lib/contexts/groups/infrastructure/sqlite/sqlite-group.repository';

@Module({
  imports: [ProgressModule],
  controllers: [GroupsController],
  providers: [
    { provide: GroupRepository, useFactory: (db: Db) => new SqliteGroupRepository(db), inject: [DB] },
    ...[ListGroupsUseCase, CreateGroupUseCase, JoinGroupUseCase, LeaveGroupUseCase, GetGroupUseCase, CanViewMemberUseCase].map((Ctor) => ({
      provide: Ctor,
      useFactory: (r: GroupRepository) => new Ctor(r),
      inject: [GroupRepository],
    })),
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
export class GroupsModule {}
