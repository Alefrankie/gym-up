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

- All authenticated users can read ALL profiles. No privacy toggle. Per [`ADR-004`](../../decisions/004-rls-visibility.md).
- All authenticated users can read ALL workouts and entries. Family-wide visibility. Per [`ADR-004`](../../decisions/004-rls-visibility.md).
- Users can only WRITE their own data. RLS enforced. Per [`ADR-004`](../../decisions/004-rls-visibility.md).
- `display_name` and `routine_type` are PUBLIC. Visible to everyone. Per `VisibilityRules.ShowStats`.
- `email` is PRIVATE. Never exposed to other users. Per `VisibilityRules.ShowEmail = false`.
- `progress_photos` are PRIVATE. Owner-only. NEVER visible in public view. No exceptions. Per [`ADR-005`](../../decisions/005-private-photos.md) and `VisibilityRules.ShowPhotos = false`.
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

Per [ADR-007](../../decisions/007-repository-pattern.md) and [ADR-011](../../decisions/011-implements-not-extends.md).

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

Per [ADR-010](../../decisions/010-per-context-composition.md), no central root.

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

### Interactive components (Svelte)

- `FamilyMemberCard.svelte` — Svelte island, card with hover effect.

### Pages

- `/family` — SSR, list of all members.
- `/family/[user_id]` — SSR, member's progress (read-only).

---

## Testing

Per [ADR-009](../../decisions/009-object-mothers.md), tests use **NO MOCKS** — only real implementations.

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

---

## Phase 2

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [12.1](../../../stories/phase-2/round-12/story-12.1.md) |
| Requirements | [FR-PV-007](../../../prd/features/public-view.md#fr-pv-007), [FR-PV-008](../../../prd/features/public-view.md#fr-pv-008), [FR-PV-009](../../../prd/features/public-view.md#fr-pv-009) |
| Decisions | [ADR-024](../../decisions/024-social-interactions.md), [ADR-004](../../decisions/004-rls-visibility.md), [ADR-023](../../decisions/023-body-metrics-privacy.md) |

Public view keeps the member list (`/family`) and member profiles (`/family/[user_id]`). The feed, likes and comments belong to [social](../social/readme.md) ([ADR-024 → Consequences](../../decisions/024-social-interactions.md)). Phase 2 adds no table and no migration to this context.

### Code reality

Types live in `src/lib/contexts/public-view/domain/member.ts` (camelCase: `displayName`, `routineType`). Use cases are `GetAllMembersUseCase`, `GetMemberDetailUseCase` and `CalculateMemberStatsUseCase`; ports are `PublicProfileRepository` and `PublicWorkoutRepository` (`getCompletedCount`, `getLastWorkoutDate`, `getCompletedByUserId`). `public-view.composition.ts` already consumes another context's use case (`CalculateStreakUseCase` from progress); Phase 2 follows the same pattern.

### FR-PV-007 — Member workouts list

`/family/[user_id]` adds an **Entrenamientos** section: the member's completed workouts, 20 per page, newest first, rendered with the social `FeedCard` and linking to `/workouts/[id]` ([FR-SO-003](../../../prd/features/social.md#fr-so-003)).

- **Reuse, not a new query.** The page calls social's `getFeedUseCase.execute({ viewerId, authorId: memberId })` ([social → Use Cases](../social/readme.md#use-cases)). With `authorId` set, `FeedQueryRepository.listCompletedPage` filters `user_id = authorId`, which uses `idx_workouts_completed (user_id, completed_at DESC)` exactly. *Cargar más* calls `GET /api/feed?author=<memberId>&cursor=…`.
- Public view adds no repository method for this list. `PublicWorkoutRepository.getCompletedByUserId` stays for the Phase 1 calendar.
- On my own member page (`/family/<my id>`) the cards show my workouts; the ❤️ button is hidden because `ownerId === viewerId` (no self-like, ADR-024 §2).
- Empty state: "Todavía no hay entrenamientos".

### FR-PV-008 — Member card additions

```ts
// src/lib/contexts/public-view/domain/member.ts (additions)
export interface MemberStats {
  totalWorkouts: number;
  currentStreak: number;      // Phase 1 day streak (FR-PR-007)
  lastWorkout: string | null;
  weeklyStreak: number;       // FR-PR-017, consecutive ISO weeks meeting days_per_week (default 3)
  prsLast30Days: number;      // PRs in completed workouts of the last 30 days
}
// MemberCard gains the same two fields: weeklyStreak, prsLast30Days.

// src/lib/contexts/public-view/domain/public-view.constants.ts
export const MemberStatsRules = {
  PrWindowDays: 30,
} as const;
```

`CalculateMemberStatsUseCase.execute({ userId, now? })` adds two inputs:

| Field | Source | Notes |
|---|---|---|
| `weeklyStreak` | progress context's weekly streak use case ([FR-PR-017](../../../prd/features/progress.md#fr-pr-017), story [11.2](../../../stories/phase-2/round-11/story-11.2.md)) | Injected like `CalculateStreakUseCase` today. The member's `days_per_week` is used internally only and never returned |
| `prsLast30Days` | `PrCountPort.countByUserSince(userId, since)` from progress ([ADR-020](../../decisions/020-personal-records.md)) | `since = (now ?? new Date()) − MemberStatsRules.PrWindowDays` days |

The card shows "🔥 N semanas" next to the day streak and "🏆 N récords (30 días)" when > 0. Wiring in `public-view.composition.ts`:

```ts
import { prCountPort } from '@/lib/contexts/progress/progress.composition';
// weekly streak use case instance from progress.composition (name per progress readme)
const statsUseCase = new CalculateMemberStatsUseCase(workoutRepo, streakUseCase, weeklyStreakUseCase, prCountPort);
```

### FR-PV-009 — Extended exclusions

```ts
// src/lib/contexts/public-view/domain/public-view.constants.ts (Phase 2)
export const VisibilityRules = {
  ShowStats: true,
  ShowWorkouts: true,
  ShowPhotos: false,              // ADR-005
  ShowEmail: false,
  ShowBodyMetrics: false,         // ADR-023 — body_measurements, body weight, bodyweight volume
  ShowReadiness: false,           // ADR-022 — readiness_checkins, workouts.readiness_score
  ShowProgressionOverrides: false,// ADR-021 — exercise_progression_overrides, deload state
  ShowAiSummaries: false,         // ADR-026 — ai_weekly_summaries
  ShowNutrition: false,           // nutrition_entries, nutrition_goals
  ShowTrainingSettings: false,    // profiles training settings + onboarding answers
} as const;
```

**Invariants (added)**

- Member cards and profiles expose only: `id`, `displayName`, `routineType`, the stats above, and the social feed items (which follow [social → Invariants](../social/readme.md#invariants)).
- `PublicProfileRepository` lists columns explicitly; it never selects `email`, the Phase 2 training/onboarding columns, deload columns, `active_program_id`, `timezone` or `activity_seen_at`.
- Owner-only tables (`body_measurements`, `readiness_checkins`, `exercise_progression_overrides`, `ai_weekly_summaries`, `progress_photos`) are already unreadable cross-user by RLS ([database-schema.md → Phase 2 table access summary](../../database-schema.md#phase-2-table-access-summary)). Public view never queries them.

### Use Cases (Phase 2)

| Use case | Purpose | Story | Status |
|----------|---------|-------|--------|
| `CalculateMemberStatsUseCase` (extended) | Adds `weeklyStreak` and `prsLast30Days` | 12.1 | planned |
| `GetMemberDetailUseCase` (unchanged) | Member header + calendar; the workouts list comes from social `GetFeedUseCase` | 12.1 | planned |

### UI (Phase 2)

| Item | File | Notes |
|---|---|---|
| Member card | `src/components/family-member-card.astro` | Adds weekly streak and 30-day PR count |
| Member profile | `src/pages/family/[user_id].astro` | Adds *Entrenamientos* with `FeedList` (island from social) fed by `getFeedUseCase` |

### Testing (Phase 2)

No mocks. Real SQLite plus the providers' real adapters.

- `tests/public-view/calculate-member-stats.use-case.test.ts`: PRs on day 29 count, day 31 do not (`now` injected); weekly streak matches progress for the same data.
- `tests/public-view/visibility.test.ts`: the keys of `MemberCard` and `MemberProfile` are exactly the allowed set (guards against leaking new profile columns).
- Feed reuse is tested in social (`authorId` filter); story 12.1 adds an E2E check that `/family/[user_id]` lists only that member's completed workouts.
