import { Controller, Get, type DynamicModule, Module } from '@nestjs/common';
import type { Db } from '@/lib/db/client';
import type { PasswordHasher } from '@/lib/contexts/auth/auth.types';
import { AuthModule } from './auth/auth.module';
import { DB, PASSWORD_HASHER, RATE_LIMITER, type RateLimiter } from './tokens';
import { FamilyModule } from './family/family.module';
import { ProgressModule } from './progress/progress.module';
import { WorkoutsModule } from './workouts/workouts.module';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { ok: true };
  }
}

export interface AppDeps {
  db: Db;
  hasher: PasswordHasher;
  /** Optional: absent in tests and local runs without the Cloudflare binding. */
  rateLimiter?: RateLimiter;
}

/** Environment-specific dependencies are supplied by the entry point (Worker or test). */
@Module({ controllers: [HealthController] })
export class AppModule {
  static register(deps: AppDeps): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [AuthModule, WorkoutsModule, ProgressModule, FamilyModule],
      providers: [
        { provide: DB, useValue: deps.db },
        { provide: PASSWORD_HASHER, useValue: deps.hasher },
        ...(deps.rateLimiter ? [{ provide: RATE_LIMITER, useValue: deps.rateLimiter }] : []),
      ],
      exports: [DB, PASSWORD_HASHER, ...(deps.rateLimiter ? [RATE_LIMITER] : [])],
    };
  }
}
