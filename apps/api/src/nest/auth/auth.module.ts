import { Global, Module } from '@nestjs/common';
import type { Db } from '@/lib/db/client';
import type { PasswordHasher } from '@/lib/contexts/auth/auth.types';
import { LocalAuthService } from '@/lib/contexts/auth/local-auth.service';
import { SqliteSessionRepository } from '@/lib/contexts/auth/sqlite-session.repository';
import { UpdateProfileUseCase } from '@/lib/contexts/workout-tracking/application/update-profile.use-case';
import { ProfileRepository } from '@/lib/contexts/workout-tracking/domain/profile.repository';
import { SqliteProfileRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/sqlite-profile.repository';
import { AuthGuard } from '../common/auth.guard';
import { AUTH_SERVICE, DB, PASSWORD_HASHER } from '../tokens';
import { AuthController } from './auth.controller';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** Global so feature modules can use AuthGuard without importing this module. */
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_SERVICE,
      useFactory: (db: Db, hasher: PasswordHasher) =>
        new LocalAuthService(new SqliteSessionRepository(db), hasher, SESSION_DURATION_MS, db),
      inject: [DB, PASSWORD_HASHER],
    },
    { provide: ProfileRepository, useFactory: (db: Db) => new SqliteProfileRepository(db), inject: [DB] },
    { provide: UpdateProfileUseCase, useFactory: (r: ProfileRepository) => new UpdateProfileUseCase(r), inject: [ProfileRepository] },
    AuthGuard,
  ],
  exports: [AUTH_SERVICE, AuthGuard],
})
export class AuthModule {}
