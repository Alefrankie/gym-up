# Public View (Family) Context

Parent: [../readme.md](../readme.md) · PRD: [../../prd/features/public-view.md](../../../prd/features/public-view.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Purpose

Family visibility: view siblings' profiles, stats, and progress. Read-only.

---

## Domain

File naming: **kebab-case**. Domain files in `src/lib/contexts/public-view/domain/`.

### `public-view.types.ts`

```ts
// src/lib/contexts/public-view/domain/public-view.types.ts

import type { RoutineType } from '@/lib/contexts/user/domain/user.constants';

export interface MemberCard {
  id: string;
  display_name: string;
  routine_type: RoutineType;
  totalWorkouts: number;
  currentStreak: number;
  lastWorkout: string | null;
}

export interface MemberStats {
  totalWorkouts: number;
  currentStreak: number;
  lastWorkout: string | null;
}

export interface MemberProfile {
  profile: MemberCard;
  workouts: Array<{ id: string; workout_date: string }>;
  stats: MemberStats;
}
```

### `public-view.constants.ts`

```ts
// src/lib/contexts/public-view/domain/public-view.constants.ts

export const VisibilityRules = {
  ShowStats: true,
  ShowWorkouts: true,
  ShowPhotos: false, // Photos are private. Per ADR-005.
  ShowEmail: false,
} as const;
```

### Entities

- `MemberCard` — derived entity. Has `id`, `display_name`, `routine_type`, `totalWorkouts`, `currentStreak`, `lastWorkout`.
- `MemberProfile` — derived entity. Has `profile`, `workouts[]`, `stats`.

### Invariants

- All authenticated users can read ALL profiles. No privacy toggle. Per [`ADR-004`](../decisions/004-rls-visibility.md).
- All authenticated users can read ALL workouts and entries. Family-wide visibility. Per [`ADR-004`](../decisions/004-rls-visibility.md).
- Users can only WRITE their own data. RLS enforced. Per [`ADR-004`](../decisions/004-rls-visibility.md).
- `display_name` and `routine_type` are PUBLIC. Visible to everyone. Per `VisibilityRules.ShowStats`.
- `email` is PRIVATE. Never exposed to other users. Per `VisibilityRules.ShowEmail = false`.
- `progress_photos` are PRIVATE. Owner-only. NEVER visible in public view. No exceptions. Per [`ADR-005`](../decisions/005-private-photos.md) and `VisibilityRules.ShowPhotos = false`.
- Member stats are COMPUTED, not stored: total workouts, current streak, last workout date.
- Public view is READ-ONLY. No edit capabilities for other users' data.

### Ports

- `PublicProfileRepository` — getAll, getById (read-only).
- `PublicWorkoutRepository` — getByUserId (read-only).

---

## Application

### Use Cases

| Use case | Purpose | Status |
|----------|---------|--------|
| GetAllProfilesUseCase | Fetch all profiles with computed stats | planned |
| GetMemberWorkoutsUseCase | Fetch specific member's completed workouts | planned |
| CalculateMemberStatsUseCase | Compute total workouts, streak, last workout for a profile | planned |

### Orchestration

1. `GetAllProfilesUseCase` calls `PublicProfileRepository.getAll()` → for each profile, compute stats → return MemberCard[].
2. `GetMemberWorkoutsUseCase` calls `PublicWorkoutRepository.getByUserId(memberId)` → return workouts.
3. `CalculateMemberStatsUseCase` calls workouts → compute total, streak, last → return stats.

---

## Infrastructure

Per [ADR-007](../decisions/007-repository-pattern.md) and [ADR-011](../decisions/011-implements-not-extends.md).

### Abstract Classes (Contracts)

```ts
// src/lib/contexts/public-view/domain/ports/public-profile-repository.ts
abstract class PublicProfileRepository {
  abstract getAll(): Promise<Profile[]>;
  abstract getById(id: string): Promise<Profile | null>;
}

// src/lib/contexts/public-view/domain/ports/public-workout-repository.ts
abstract class PublicWorkoutRepository {
  abstract getByUserId(userId: string): Promise<Workout[]>;
  abstract getCompletedByUserId(userId: string): Promise<Workout[]>;
}
```

### Supabase Implementation (Production)

```ts
// src/lib/contexts/public-view/infrastructure/supabase/supabase-public-profile.repository.ts
class SupabasePublicProfileRepository implements PublicProfileRepository {
  constructor(private supabase: SupabaseClient) {}

  async getAll(): Promise<Profile[]> {
    const { data, error } = await this.supabase.from('profiles').select('id, display_name, routine_type');
    if (error) throw new Error(error.message);
    return data;
  }
}

// src/lib/contexts/public-view/infrastructure/supabase/supabase-public-workout.repository.ts
class SupabasePublicWorkoutRepository implements PublicWorkoutRepository {
  constructor(private supabase: SupabaseClient) {}

  async getCompletedByUserId(userId: string): Promise<Workout[]> {
    const { data, error } = await this.supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed');
    if (error) throw new Error(error.message);
    return data;
  }
}
```

### SQLite Implementation (Tests, E2E)

```ts
// src/lib/contexts/public-view/infrastructure/sqlite/sqlite-public-profile.repository.ts
class SqlitePublicProfileRepository implements PublicProfileRepository {
  constructor(private db: Database) {}

  async getAll(): Promise<Profile[]> {
    return this.db.prepare('SELECT id, display_name, routine_type FROM profiles').all();
  }
}

// src/lib/contexts/public-view/infrastructure/sqlite/sqlite-public-workout.repository.ts
class SqlitePublicWorkoutRepository implements PublicWorkoutRepository {
  constructor(private db: Database) {}

  async getCompletedByUserId(userId: string): Promise<Workout[]> {
    return this.db.prepare('SELECT * FROM workouts WHERE user_id = ? AND status = ?').all(userId, 'completed');
  }
}
```

### Wiring (Per-Context Composition)

Per [ADR-010](../decisions/010-per-context-composition.md), no central root.

`src/lib/contexts/public-view/public-view.composition.ts`:

```ts
import { useSupabase, supabaseClient, sqliteDb } from '@/lib/config';
import { SupabasePublicProfileRepository } from './infrastructure/supabase/SupabasePublicProfileRepository';
import { SqlitePublicProfileRepository } from './infrastructure/sqlite/SqlitePublicProfileRepository';
import { SupabasePublicWorkoutRepository } from './infrastructure/supabase/SupabasePublicWorkoutRepository';
import { SqlitePublicWorkoutRepository } from './infrastructure/sqlite/SqlitePublicWorkoutRepository';
import { GetAllProfilesUseCase } from './application/GetAllProfilesUseCase';
import { GetMemberWorkoutsUseCase } from './application/GetMemberWorkoutsUseCase';
import { CalculateMemberStatsUseCase } from './application/CalculateMemberStatsUseCase';

const profileRepo: PublicProfileRepository = useSupabase
  ? new SupabasePublicProfileRepository(supabaseClient)
  : new SqlitePublicProfileRepository(sqliteDb);

const workoutRepo: PublicWorkoutRepository = useSupabase
  ? new SupabasePublicWorkoutRepository(supabaseClient)
  : new SqlitePublicWorkoutRepository(sqliteDb);

export const getAllProfilesUseCase = new GetAllProfilesUseCase(profileRepo, workoutRepo);
export const getMemberWorkoutsUseCase = new GetMemberWorkoutsUseCase(workoutRepo);
export const calculateMemberStatsUseCase = new CalculateMemberStatsUseCase(workoutRepo);
```

---

## UI

### Components

- `FamilyMemberCard` — card with name, routine, stats.

### Interactive components (Astro islands)

- `FamilyMemberCard.svelte` — Svelte island, card with hover effect.

### Pages

- `/family` — SSR, list of all members.
- `/family/[user_id]` — SSR, member's progress (read-only).

---

## Testing

Per [ADR-009](../decisions/009-object-mothers.md), tests use **NO MOCKS** — only real implementations.

`src/test/contexts/public-view/GetAllProfilesUseCase.test.ts`:

```ts
import { faker } from '@faker-js/faker';
import { createTestDb } from '@/test/setup';
import { SqlitePublicProfileRepository } from '@/lib/contexts/public-view/infrastructure/sqlite/SqlitePublicProfileRepository';
import { SqlitePublicWorkoutRepository } from '@/lib/contexts/public-view/infrastructure/sqlite/SqlitePublicWorkoutRepository';
import { GetAllProfilesUseCase } from '@/lib/contexts/public-view/application/GetAllProfilesUseCase';
import { ProfileMother } from '@/test/mothers/ProfileMother';
import { WorkoutMother } from '@/test/mothers/WorkoutMother';

describe('GetAllProfilesUseCase', () => {
  it('returns all profiles with computed stats', async () => {
    const db = createTestDb();
    const profileRepo = new SqlitePublicProfileRepository(db);
    const workoutRepo = new SqlitePublicWorkoutRepository(db);
    const profile = await profileRepo.create(ProfileMother.male());
    await workoutRepo.createCompleted(WorkoutMother.completed({ user_id: profile.id }));
    const useCase = new GetAllProfilesUseCase(profileRepo, workoutRepo);

    const result = await useCase.execute();

    expect(result).toHaveLength(1);
    expect(result[0].totalWorkouts).toBe(1);
  });
});
```

---

## Flows

- [view-family.flow.md](./flows/view-family.flow.md)
