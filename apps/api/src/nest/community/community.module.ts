import { Module } from '@nestjs/common';
import type { Db } from '@/lib/db/client';
import { CommunityUseCases } from '@/lib/contexts/community/application/community.use-cases';
import { SqliteCommunityRepository } from '@/lib/contexts/community/infrastructure/sqlite/sqlite-community.repository';
import type { PhotoStorage } from '@/lib/contexts/private-photos/domain/photo-storage';
import { DB, PHOTO_STORAGE } from '../tokens';
import { CommunityController } from './community.controller';

@Module({
  controllers: [CommunityController],
  providers: [
    {
      provide: CommunityUseCases,
      useFactory: (db: Db, storage: PhotoStorage | null) => new CommunityUseCases(new SqliteCommunityRepository(db), storage),
      inject: [DB, PHOTO_STORAGE],
    },
  ],
})
export class CommunityModule {}
