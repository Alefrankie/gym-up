# User Context

Parent: [../readme.md](../readme.md) · PRD: [../../prd/features/workout-tracking.md](../../../prd/features/workout-tracking.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Purpose

User profile management. Display name, routine preference, weight unit, calorie goal.

---

## Domain

File naming: **kebab-case**. Domain files in `src/lib/contexts/user/domain/`.

### `user.types.ts`

```ts
// src/lib/contexts/user/domain/user.types.ts

import type { RoutineType, WeightUnit, BiologicalSex } from './user.constants';

export interface Profile {
  id: string;
  display_name: string;
  routine_type: RoutineType;
  weight_unit: WeightUnit;
  calorie_goal: number | null;
  // Optional biometric data for nutrition/workout calculations
  birth_date?: string;        // ISO date for age calculation
  biological_sex?: BiologicalSex; // for calorie/macro calculations
  weight_kg?: number;         // current body weight
  height_cm?: number;         // height in cm
  activity_level?: ActivityLevel; // for TDEE calculation
  created_at: string;
}

export interface UpdateProfileDTO {
  display_name?: string;
  routine_type?: RoutineType;
  weight_unit?: WeightUnit;
  calorie_goal?: number | null;
  birth_date?: string;
  biological_sex?: BiologicalSex;
  weight_kg?: number;
  height_cm?: number;
  activity_level?: ActivityLevel;
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
```

### `user.constants.ts`

```ts
// src/lib/contexts/user/domain/user.constants.ts

export const RoutineTypes = {
  Hombre: 'hombre',
  Mujer: 'mujer',
} as const;
export type RoutineType = (typeof RoutineTypes)[keyof typeof RoutineTypes];

export const WeightUnits = {
  Kg: 'kg',
  Lbs: 'lbs',
} as const;
export type WeightUnit = (typeof WeightUnits)[keyof typeof WeightUnits];

export const BiologicalSexes = {
  Male: 'male',
  Female: 'female',
} as const;
export type BiologicalSex = (typeof BiologicalSexes)[keyof typeof BiologicalSexes];

export const ActivityLevels = {
  Sedentary: 'sedentary',     // desk job, no exercise
  Light: 'light',            // light exercise 1-3 days/week
  Moderate: 'moderate',      // moderate exercise 3-5 days/week
  Active: 'active',          // heavy exercise 6-7 days/week
  VeryActive: 'very_active',  // physical job + exercise
} as const;
export type ActivityLevel = (typeof ActivityLevels)[keyof typeof ActivityLevels];

export const DisplayNameRules = {
  MinLength: 1,
  MaxLength: 50,
} as const;

// === USER PROFILE / BIOMETRIC INVARIANTS ===
export const AgeRules = {
  MinAge: 13,             // minimum age (parental consent for younger)
  AdultAge: 18,
  SeniorAge: 60,
  MaxAge: 120,           // upper safety bound
  RequireParentalConsentBelow: 16,
} as const;

export const WeightRules = {
  MinKg: 20,              // 20kg lower bound (safety)
  MaxKg: 300,             // 300kg upper bound
  TypicalAdultMinKg: 40,
  TypicalAdultMaxKg: 200,
  // Healthy BMI range
  MinBMI: 12,             // severe underweight
  MaxBMI: 40,             // severe obesity
  HealthyBMIMin: 18.5,
  HealthyBMIMax: 24.9,
} as const;

export const HeightRules = {
  MinCm: 100,            // 1m (child)
  MaxCm: 250,            // 2.5m upper bound
  TypicalAdultMinCm: 140,
  TypicalAdultMaxCm: 220,
} as const;

export const CalorieGoalRules = {
  Min: 1,
  Max: 10000,
  Default: 2000,
} as const;
```

### Entities

- `Profile` — user profile. Has `id` (UUID, same as auth.users.id), `display_name`, `routine_type`, `weight_unit`, `calorie_goal`, optional `birth_date`, `biological_sex`, `weight_kg`, `height_cm`, `activity_level`, `created_at`.

### Value Objects

- `RoutineType` — enum: `'hombre'`, `'mujer'`. Per `RoutineTypes` in `user.constants.ts`.
- `WeightUnit` — enum: `'kg'`, `'lbs'`. Per `WeightUnits` in `user.constants.ts`.
- `BiologicalSex` — enum: `'male'`, `'female'`. Per `BiologicalSexes`.
- `ActivityLevel` — enum: `'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'`. Per `ActivityLevels`.
- `DisplayName` — string, 1-50 characters, non-empty. Per `DisplayNameRules`.
- `CalorieGoal` — positive integer, optional, in kcal. Per `CalorieGoalRules`.
- `Age` — derived from `birth_date`. Must be in [`AgeRules.MinAge`, `AgeRules.MaxAge`].
- `BMI` — derived from `weight_kg` / `height_m²`. Used for health recommendations.
- `TDEE` — Total Daily Energy Expenditure. Calculated from BMR + activity level.

### Invariants

#### Account invariants
- `id` MUST match `auth.users.id`. 1:1 relationship. Cannot be changed.
- `display_name` MUST be non-empty string, max `DisplayNameRules.MaxLength` (50) characters.
- `routine_type` MUST be `'hombre'` or `'mujer'`. No other values.
- `weight_unit` MUST be `'kg'` or `'lbs'`. Defaults to `'kg'`. Per [`ADR-006`](../decisions/006-kg-storage.md).
- `calorie_goal` MUST be null or integer in range [`CalorieGoalRules.Min`, `CalorieGoalRules.Max`].
- Profile is auto-created on registration. Cannot be manually created.
- Profile can only be updated by the owner. RLS enforced. Per [`ADR-004`](../decisions/004-rls-visibility.md).

#### Biometric invariants
- `birth_date` MUST be a valid ISO date string (YYYY-MM-DD).
- Age derived from `birth_date` MUST be in range [`AgeRules.MinAge`, `AgeRules.MaxAge`] = [13, 120].
- Users below `AgeRules.RequireParentalConsentBelow` (16) MUST have parental consent (future feature).
- `biological_sex` MUST be `'male'` or `'female'`.
- `weight_kg` MUST be in range [`WeightRules.MinKg`, `WeightRules.MaxKg`] = [20, 300].
- `weight_kg` for typical adults SHOULD be in range [`WeightRules.TypicalAdultMinKg`, `WeightRules.TypicalAdultMaxKg`] = [40, 200].
- `height_cm` MUST be in range [`HeightRules.MinCm`, `HeightRules.MaxCm`] = [100, 250].
- `height_cm` for typical adults SHOULD be in range [`HeightRules.TypicalAdultMinCm`, `HeightRules.TypicalAdultMaxCm`] = [140, 220].
- `activity_level` MUST be one of: `'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'`.
- BMI (derived from `weight_kg` / `(height_cm/100)²`) MUST be in range [`WeightRules.MinBMI`, `WeightRules.MaxBMI`] = [12, 40] for valid health data.
- User SHOULD aim for BMI in range [`WeightRules.HealthyBMIMin`, `WeightRules.HealthyBMIMax`] = [18.5, 24.9]. Warning shown if outside.

#### TDEE-based calorie goal invariants
- `calorie_goal` MUST NOT be below user's BMR (Basal Metabolic Rate).
- BMR calculated via Mifflin-St Jeor:
  - Male: `BMR = 10 × weight_kg + 6.25 × height_cm - 5 × age + 5`
  - Female: `BMR = 10 × weight_kg + 6.25 × height_cm - 5 × age - 161`
- TDEE = BMR × activity multiplier:
  - Sedentary: 1.2
  - Light: 1.375
  - Moderate: 1.55
  - Active: 1.725
  - VeryActive: 1.9
- Default `calorie_goal` = TDEE (maintenance).
- Weight loss `calorie_goal` = TDEE - 500 (lose 0.5kg/week).
- Weight gain `calorie_goal` = TDEE + 500 (gain 0.5kg/week).

### Ports

- `ProfileRepository` (interface) — getById, update.
- `CalorieGoalRepository` (interface) — getGoal, setGoal.

---

## Application

### Use Cases

| Use case | Purpose | Status |
|----------|---------|--------|
| GetProfileUseCase | Fetch current user's profile | planned |
| UpdateDisplayNameUseCase | Change display_name (1-50 chars) | planned |
| UpdateRoutineTypeUseCase | Switch routine_type (warning: doesn't affect past workouts) | planned |
| UpdateWeightUnitUseCase | Toggle weight_unit (kg/lbs). Affects all displays. | planned |
| SetCalorieGoalUseCase | Set daily calorie goal (null to clear) | planned |

### Orchestration

1. `GetProfileUseCase` calls `ProfileRepository.getById(userId)` → returns Profile.
2. `UpdateDisplayNameUseCase` validates DisplayName (1-50 chars) → calls `ProfileRepository.update()`.
3. `UpdateRoutineTypeUseCase` validates RoutineType → calls `ProfileRepository.update()`. Warning: past workouts unaffected.
4. `UpdateWeightUnitUseCase` validates WeightUnit → calls `ProfileRepository.update()`. All weight displays change immediately.
5. `SetCalorieGoalUseCase` validates CalorieGoal (null or 1-10000) → calls `CalorieGoalRepository.setGoal()`.

---

## Infrastructure

Per [ADR-007](../decisions/007-repository-pattern.md) and [ADR-011](../decisions/011-implements-not-extends.md).

### Abstract Classes (Contracts)

```ts
// src/lib/contexts/user/domain/ports/profile-repository.ts
abstract class ProfileRepository {
  abstract getById(id: string): Promise<Profile | null>;
  abstract update(id: string, data: UpdateProfileDTO): Promise<Profile>;
}

// src/lib/contexts/user/domain/ports/nutrition-goal-repository.ts
abstract class NutritionGoalRepository {
  abstract getGoal(userId: string): Promise<number | null>;
  abstract setGoal(userId: string, goal: number | null): Promise<void>;
}
```

### Supabase Implementation (Production)

```ts
// src/lib/contexts/user/infrastructure/supabase/supabase-profile.repository.ts
class SupabaseProfileRepository implements ProfileRepository {
  constructor(private supabase: SupabaseClient) {}

  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await this.supabase.from('profiles').select('*').eq('id', id).single();
    if (error && error.code === 'PGRST116') return null;
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, data: UpdateProfileDTO): Promise<Profile> {
    const { data: row, error } = await this.supabase.from('profiles').update(data).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return row;
  }
}
```

### SQLite Implementation (Tests, E2E)

```ts
// src/lib/contexts/user/infrastructure/sqlite/sqlite-profile.repository.ts
class SqliteProfileRepository implements ProfileRepository {
  constructor(private db: Database) {}

  async getById(id: string): Promise<Profile | null> {
    const row = this.db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
    return row || null;
  }

  async update(id: string, data: UpdateProfileDTO): Promise<Profile> {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);
    this.db.prepare(`UPDATE profiles SET ${fields} WHERE id = ?`).run(...values, id);
    return this.getById(id);
  }
}
```

### Wiring (Per-Context Composition)

Per [ADR-010](../decisions/010-per-context-composition.md), no central root.

`src/lib/contexts/user/user.composition.ts`:

```ts
import { useSupabase, supabaseClient, sqliteDb } from '@/lib/config';
import { SupabaseProfileRepository } from './infrastructure/supabase/SupabaseProfileRepository';
import { SqliteProfileRepository } from './infrastructure/sqlite/SqliteProfileRepository';
import { SupabaseNutritionGoalRepository } from './infrastructure/supabase/SupabaseNutritionGoalRepository';
import { SqliteNutritionGoalRepository } from './infrastructure/sqlite/SqliteNutritionGoalRepository';
import { GetProfileUseCase } from './application/GetProfileUseCase';
import { UpdateDisplayNameUseCase } from './application/UpdateDisplayNameUseCase';
import { UpdateWeightUnitUseCase } from './application/UpdateWeightUnitUseCase';
import { SetCalorieGoalUseCase } from './application/SetCalorieGoalUseCase';

const profileRepo: ProfileRepository = useSupabase
  ? new SupabaseProfileRepository(supabaseClient)
  : new SqliteProfileRepository(sqliteDb);

const goalRepo: NutritionGoalRepository = useSupabase
  ? new SupabaseNutritionGoalRepository(supabaseClient)
  : new SqliteNutritionGoalRepository(sqliteDb);

export const getProfileUseCase = new GetProfileUseCase(profileRepo);
export const updateDisplayNameUseCase = new UpdateDisplayNameUseCase(profileRepo);
export const updateWeightUnitUseCase = new UpdateWeightUnitUseCase(profileRepo);
export const setCalorieGoalUseCase = new SetCalorieGoalUseCase(goalRepo);
```

---

## UI

### Components

- Settings form with fields:
  - `display_name` — text input
  - `routine_type` — radio (hombre/mujer)
  - `weight_unit` — radio (kg/lbs)
  - `calorie_goal` — number input (optional)
- Save button. Logout button.

### Interactive components (Astro islands)

- `SettingsForm.svelte` — Svelte island, form with client-side validation and save.

### Pages

- `/settings` — SSR page with settings form.

---

## Testing

Per [ADR-009](../decisions/009-object-mothers.md), tests use **NO MOCKS** — only real implementations.

`src/test/contexts/user/GetProfileUseCase.test.ts`:

```ts
import { faker } from '@faker-js/faker';
import { createTestDb } from '@/test/setup';
import { SqliteProfileRepository } from '@/lib/contexts/user/infrastructure/sqlite/SqliteProfileRepository';
import { GetProfileUseCase } from '@/lib/contexts/user/application/GetProfileUseCase';
import { ProfileMother } from '@/test/mothers/ProfileMother';

describe('GetProfileUseCase', () => {
  it('returns profile by id', async () => {
    const db = createTestDb();
    const repo = new SqliteProfileRepository(db);
    const profile = await repo.create(ProfileMother.male());
    const useCase = new GetProfileUseCase(repo);

    const result = await useCase.execute(profile.id);

    expect(result?.id).toBe(profile.id);
  });
});
```

Object Mother:

```ts
// ProfileMother.ts
export class ProfileMother {
  static male(overrides = {}): Profile {
    return {
      id: faker.string.uuid(),
      display_name: faker.person.fullName(),
      routine_type: 'hombre',
      weight_unit: 'kg',
      calorie_goal: faker.number.int({ min: 1500, max: 3500 }),
      created_at: faker.date.recent().toISOString(),
      ...overrides,
    };
  }

  static female(overrides = {}): Profile {
    return this.male({ routine_type: 'mujer', ...overrides });
  }
}
```

---

## Flows

- [update-settings.flow.md](./flows/update-settings.flow.md)
