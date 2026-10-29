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
- `weight_unit` MUST be `'kg'` or `'lbs'`. Defaults to `'kg'`. Per [`ADR-006`](../../decisions/006-kg-storage.md).
- `calorie_goal` MUST be null or integer in range [`CalorieGoalRules.Min`, `CalorieGoalRules.Max`].
- Profile is auto-created on registration. Cannot be manually created.
- Profile can only be updated by the owner. RLS enforced. Per [`ADR-004`](../../decisions/004-rls-visibility.md).

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

Per [ADR-007](../../decisions/007-repository-pattern.md) and [ADR-011](../../decisions/011-implements-not-extends.md).

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

Per [ADR-010](../../decisions/010-per-context-composition.md), no central root.

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

### Interactive components (Svelte)

- `SettingsForm.svelte` — Svelte island, form with client-side validation and save.

### Pages

- `/settings` — SSR page with settings form.

---

## Testing

Per [ADR-009](../../decisions/009-object-mothers.md), tests use **NO MOCKS** — only real implementations.

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

---

## Phase 2

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-10-01 |
| Phase | 2 |
| Story | [9.4](../../../stories/phase-2/round-9/story-9.4.md) |
| Requirements | [FR-WT-037](../../../prd/features/workout-tracking.md#fr-wt-037), [FR-WT-044](../../../prd/features/workout-tracking.md#fr-wt-044), [FR-WT-045](../../../prd/features/workout-tracking.md#fr-wt-045) |
| Decisions | [ADR-018](../../decisions/018-user-owned-programs.md), [ADR-019](../../decisions/019-rotation-scheduling-and-onboarding.md), [ADR-021](../../decisions/021-progression-engine.md), [ADR-024](../../decisions/024-social-interactions.md) |

Phase 2 adds many columns to `profiles`. Several contexts write them. This section says which context owns each write, and describes the Settings page v2.

### Code reality

There is **no `src/lib/contexts/user/` folder** in the code. The sections above describe a planned context that was never built:

| Doc above says | Code does |
|---|---|
| `user/domain/ports/profile-repository.ts` with `getById` | `src/lib/contexts/workout-tracking/domain/profile.repository.ts`: `findById`, `findByEmail`, `create`, `update(id, patch: Partial<Pick<Profile, 'displayName' \| 'routineType' \| 'weightUnit'>>)` |
| `UpdateDisplayNameUseCase`, `UpdateRoutineTypeUseCase`, `UpdateWeightUnitUseCase` | One `UpdateProfileUseCase` in `workout-tracking/application/update-profile.use-case.ts` (`ProfileRules.MaxDisplayNameLength = 100`, typed errors `DisplayNameRequiredError`, `DisplayNameTooLongError`, `InvalidRoutineTypeError`, `InvalidWeightUnitError`) |
| `SetCalorieGoalUseCase` in user | `nutrition/application/set-calorie-goal.use-case.ts` (story 5.3) |
| `SettingsForm.svelte` island | `src/pages/settings.astro` is its own POST target (PRG: `POST → 302 /settings?saved=1`), no `/api/settings` |

Phase 2 keeps this layout: profile settings stay in **workout-tracking**, and no `user/` folder is created.

### New `profiles` columns and their owners

Columns come from [database-schema.md → Phase 2 Migrations](../../database-schema.md#phase-2-migrations). A column is written **only** by its owning context. Other contexts may read it.

| Column | Migration | Default | Written by (context → use case) | Read by |
|---|---|---|---|---|
| `weight_unit` (Phase 1) | 001 | `kg` | settings → `UpdateTrainingSettingsUseCase` | every display ([ADR-006](../../decisions/006-kg-storage.md)) |
| `default_rest_seconds` | 004 | 90 | settings → `UpdateTrainingSettingsUseCase` | workout-tracking (live island rest timer) |
| `bar_weight_kg` | 004 | 20 | settings → `UpdateTrainingSettingsUseCase` | workout-tracking tools (plate calculator), progression (rounding) |
| `available_plates_kg` (JSON `number[]`) | 004 | `[25,20,15,10,5,2.5,1.25]` | settings → `UpdateTrainingSettingsUseCase` | workout-tracking tools, progression (rounding) |
| `rpe_enabled` | 004 | false | settings → `UpdateTrainingSettingsUseCase` | workout-tracking (RPE column) |
| `progression_enabled` | 004 | true | settings → `UpdateTrainingSettingsUseCase` | progression, workout-tracking ([FR-PG-013](../../../prd/features/progression.md#fr-pg-013)) |
| `readiness_enabled` | 004 | true | settings → `UpdateTrainingSettingsUseCase` | progression (readiness check-in) |
| `timezone` | 004 | `UTC` | settings → `UpdateTrainingSettingsUseCase` | progress (ISO weeks, AI summary, CSV times), routines, progression, social (share image date) |
| `active_program_id` | 006 | null | **routines** → `AdoptTemplateUseCase`, `SetActiveProgramUseCase` (through `ProfileProgramSettings`) | routines (next workout), progression, workout-tracking (dashboard) |
| `training_goal`, `experience_level`, `days_per_week`, `equipment_profile`, `focus`, `onboarding_completed_at` | 006 | null | **routines** → `SubmitOnboardingUseCase`, `DismissOnboardingUseCase` ([FR-RT-015](../../../prd/features/routines.md#fr-rt-015)) | routines (recommendation), progress (weekly streak and planned workouts use `days_per_week`) |
| `deload_until`, `last_deload_at`, `deload_snoozed_until` | 007 | null | **progression** → `StartDeloadUseCase` / `SnoozeDeloadUseCase` / `EndDeloadUseCase` through `ProgressionProfilePort.updateDeloadState` ([FR-PG-008](../../../prd/features/progression.md#fr-pg-008)) | progression, workout-tracking (`workouts.is_deload` on start) |
| `activity_seen_at` | 010 | `now()` | **social** → `MarkActivitySeenUseCase` | social (activity dot) |
| `routine_type` (Phase 1) | 001 | — | auth (registration) only. Settings no longer edits it | routines: onboarding hint and the 006 template adoption ([ADR-018 §3](../../decisions/018-user-owned-programs.md)) |

`routine_type` is now **only an onboarding hint**. Programs are user-owned ([ADR-018](../../decisions/018-user-owned-programs.md)) and switching program goes through Ajustes → *Cambiar programa*. The column stays `NOT NULL` so registration and Phase 1 data are unchanged. `hombre` / `mujer` are Phase 1 template tags.

### Drizzle additions (`db/schema.ts`, `profiles`)

Each story adds its own columns. Story 9.4 only needs the 004 columns (added by story 7.1's migration).

```ts
// 004 — story 7.1 (used by 9.4)
defaultRestSeconds: integer('default_rest_seconds').notNull().default(90),
barWeightKg: real('bar_weight_kg').notNull().default(20),
availablePlatesKg: text('available_plates_kg').notNull().default('[25,20,15,10,5,2.5,1.25]'), // JSON number[]
rpeEnabled: integer('rpe_enabled', { mode: 'boolean' }).notNull().default(false),
progressionEnabled: integer('progression_enabled', { mode: 'boolean' }).notNull().default(true),
readinessEnabled: integer('readiness_enabled', { mode: 'boolean' }).notNull().default(true),
timezone: text('timezone').notNull().default('UTC'),
// 006 — story 8.1 (routines). profiles ↔ routines is circular: annotate the reference.
activeProgramId: text('active_program_id').references((): AnySQLiteColumn => routines.id, { onDelete: 'set null' }),
trainingGoal: text('training_goal', { enum: ['strength', 'hypertrophy', 'general'] }),
experienceLevel: text('experience_level', { enum: ['beginner', 'intermediate', 'advanced'] }),
daysPerWeek: integer('days_per_week'),
equipmentProfile: text('equipment_profile', { enum: ['full_gym', 'dumbbells', 'bodyweight'] }),
focus: text('focus', { enum: ['balanced', 'glutes_legs', 'upper_body'] }),
onboardingCompletedAt: integer('onboarding_completed_at', { mode: 'timestamp' }),
// 007 — story 10.2/10.3 (progression). DATE → timestamp_ms
deloadUntil: integer('deload_until', { mode: 'timestamp_ms' }),
lastDeloadAt: integer('last_deload_at', { mode: 'timestamp_ms' }),
deloadSnoozedUntil: integer('deload_snoozed_until', { mode: 'timestamp_ms' }),
// 010 — story 12.1 (social)
activitySeenAt: integer('activity_seen_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
```

### Settings use cases (where they live)

| Use case | File | Story | Status |
|---|---|---|---|
| `UpdateProfileUseCase` (Phase 1, unchanged) | `src/lib/contexts/workout-tracking/application/update-profile.use-case.ts` | 4.3 | done |
| `UpdateTrainingSettingsUseCase` | `src/lib/contexts/workout-tracking/application/update-training-settings.use-case.ts` | 9.4 | planned |

`UpdateTrainingSettingsUseCase` is wired in `workout-tracking.composition.ts` next to `updateProfileUseCase` and uses the same `ProfileRepository`. The repository's `update` patch type widens to the **settings-owned** columns only:

```ts
// src/lib/contexts/workout-tracking/domain/profile.repository.ts
export type ProfilePatch = Partial<Pick<Profile,
  | 'displayName' | 'routineType' | 'weightUnit'
  | 'defaultRestSeconds' | 'barWeightKg' | 'availablePlatesKg'
  | 'rpeEnabled' | 'progressionEnabled' | 'readinessEnabled' | 'timezone'>>;

abstract update(id: string, patch: ProfilePatch): Promise<Profile>;
```

Columns owned by routines, progression and social are **not** in `ProfilePatch`. Those contexts write them through their own repositories, so a settings form can never overwrite `active_program_id`, a deload or `activity_seen_at`.

```ts
// src/lib/contexts/workout-tracking/application/update-training-settings.use-case.ts
export const TrainingSettingsRules = {
  RestSecondsMin: 0,           // 0 = no timer (ADR-016 §5)
  RestSecondsMax: 600,
  BarWeightKgMin: 0,
  BarWeightKgMax: 50,
  PlateKgMax: 50,
  MaxPlateKinds: 12,
} as const;

export const TrainingDefaults = {
  kg: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
  lbs: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] },   // in lb, stored converted to kg
} as const;

export interface UpdateTrainingSettingsInput {
  userId: string;
  weightUnit?: 'kg' | 'lbs';
  defaultRestSeconds?: number;
  barWeight?: number;          // in the submitted weightUnit
  availablePlates?: number[];  // in the submitted weightUnit
  rpeEnabled?: boolean;
  progressionEnabled?: boolean;
  readinessEnabled?: boolean;
  timezone?: string;           // IANA name
}
```

Validation, before any write (typed errors, as in `UpdateProfileUseCase`): `InvalidWeightUnitError` (reused), `InvalidRestSecondsError` (integer in [0, 600]), `InvalidBarWeightError` ([0, 50] kg after conversion), `InvalidPlatesError` (1–12 distinct values in (0, 50] kg; stored sorted descending as JSON), `InvalidTimezoneError` (`new Intl.DateTimeFormat('en', { timeZone })` must not throw).

- lbs input is converted with 1 lb = 0.45359237 kg and stored unrounded ([ADR-006](../../decisions/006-kg-storage.md)); display rounds back to the unit.
- Decision: when `weightUnit` changes and the stored bar and plates still equal the **old** unit's defaults, they switch to the new unit's defaults (Hevy keeps unit-native plates). Customized values are kept.
- Decision: bar weight range [0, 50] kg and plate list 1–12 values are the simplest bounds that cover every bar and plate set in use; neither Hevy nor the PRD sets limits.

### Settings page v2 (`/settings`)

Reached from the **Perfil** tab hub `/profile` → *Ajustes* ([FR-WT-044](../../../prd/features/workout-tracking.md#fr-wt-044), [FR-WT-045](../../../prd/features/workout-tracking.md#fr-wt-045)). It stays SSR with PRG on itself. Each section is its own `<form method="post">` with a hidden `section` field, so a validation error in one section never discards another. Success redirects to `/settings?saved=<section>#<section>`.

| Section | Fields / actions | Writes via | Owning context | Req |
|---|---|---|---|---|
| **Entrenamiento** | Unidad de peso, Descanso por defecto (0 = "Sin temporizador"), Peso de la barra, Discos disponibles (chips + add/remove), Registrar RPE | `UpdateTrainingSettingsUseCase` | workout-tracking (settings) | FR-WT-037 |
| **Programa** | Active program name; *Cambiar programa* (onboarding questionnaire with "Mantener mi programa actual"); *Ver programas* → `/train` | routines `SubmitOnboardingUseCase` / `DismissOnboardingUseCase` / `AdoptTemplateUseCase` / `SetActiveProgramUseCase` ([routines readme](../routines/readme.md)) | routines | [FR-RT-015](../../../prd/features/routines.md#fr-rt-015), ADR-018, ADR-019 |
| **Progresión** | Sugerencias de progresión, Check-in de energía (toggles); when a deload is active: "Descarga activa hasta {date}" + *Terminar descarga* | toggles: `UpdateTrainingSettingsUseCase`; deload: progression `EndDeloadUseCase` via `POST /api/progression/deload/end` ([progression readme](../progression/readme.md)) | workout-tracking (toggles), progression (deload) | FR-WT-037, FR-PG-008, FR-PG-013 |
| **Exportar datos** | *Exportar entrenamientos (CSV)*, *Exportar medidas (CSV)* (download links) | progress / body-metrics export endpoints (story 12.4) | progress, body-metrics | [FR-PR-021](../../../prd/features/progress.md#fr-pr-021), [FR-BM-008](../../../prd/features/body-metrics.md#fr-bm-008) |
| **Cuenta** | Nombre, Zona horaria, Meta calórica (Phase 1 block, unchanged), *Cerrar sesión* | `UpdateProfileUseCase` (`displayName`), `UpdateTrainingSettingsUseCase` (`timezone`), nutrition `SetCalorieGoalUseCase` | workout-tracking, nutrition | FR-WT-016, FR-WT-017 |

- The Phase 1 **routine type radio is removed** from the page. `UpdateProfileUseCase` still accepts `routineType` (Phase 1 tests and callers), but `/settings` no longer sends it.
- Decision: the two progression toggles of FR-WT-037 are rendered in the **Progresión** section, next to the deload status, instead of under Entrenamiento. Same columns, same use case; only the grouping differs.
- Decision: *Zona horaria* is a select of IANA names, preselected with the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` while the stored value is still the default `UTC` (Hevy uses the device timezone).

### Testing (Phase 2)

No mocks ([ADR-009](../../decisions/009-object-mothers.md)), real SQLite (`tests/workout-tracking/test-db.ts`).

- `tests/workout-tracking/update-training-settings.use-case.test.ts`: rest 0 and 600 valid, −1 and 601 invalid; plates empty / duplicate / > 50 kg / 13 values invalid; lbs → kg conversion (45 lb bar ≈ 20.41 kg); unit switch replaces untouched defaults and keeps custom ones; invalid timezone; a patch never touches `activeProgramId`, deload columns or `activitySeenAt`.
- `tests/workout-tracking/sqlite-profile.repository.test.ts`: `update` with the widened `ProfilePatch`; JSON round-trip of `availablePlatesKg`.
- `tests/supabase/rls-profile-settings.integration.test.ts`: as **non-owner**, updating another profile's training settings affects 0 rows; the owner's update succeeds.
- Phase 1 fixture regression ([Phase rules §6](../../../stories/phase-2/readme.md#6-phase-1-compatibility)): existing profiles read the 004 defaults and `/settings` renders.
