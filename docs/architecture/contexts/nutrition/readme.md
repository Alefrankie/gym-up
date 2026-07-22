# Nutrition Context

Parent: [../readme.md](../readme.md) · PRD: [../../prd/features/nutrition.md](../../../prd/features/nutrition.md)

| Field | Value |
|-------|-------|
| Status | planned |
| Last edited | 2026-07-21 |

## Purpose

Photo-based nutrition analysis. User takes photo of food, AI estimates calories and macros.

---

## Domain

File naming: **kebab-case**. Domain files in `src/lib/contexts/nutrition/domain/`.

### `nutrition.types.ts`

```ts
// src/lib/contexts/nutrition/domain/nutrition.types.ts

import type { FoodItem } from './nutrition.types';

export interface NutritionEntry {
  id: string;
  user_id: string;
  photo_path: string;
  photo_date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  food_items: FoodItem[];
  ai_raw_response: Record<string, unknown> | null;
  user_edited: boolean;
  created_at: string;
}

export interface FoodItem {
  name: string;
  estimated_calories: number;
  estimated_protein: number;
  estimated_carbs: number;
  estimated_fat: number;
}

export interface AIAnalysisResult {
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  food_items: FoodItem[];
}

export interface NutritionEntryCreateDTO {
  user_id: string;
  photo_path: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  food_items: FoodItem[];
  ai_raw_response: Record<string, unknown> | null;
  user_edited: boolean;
}

export interface DailySummary {
  consumed: number;
  goal: number | null;
  remaining: number | null;
}
```

### `nutrition.constants.ts`

```ts
// src/lib/contexts/nutrition/domain/nutrition.constants.ts

export const PhotoRules = {
  MaxSizeBytes: 5 * 1024 * 1024, // 5MB
  AcceptedFormats: ['jpg', 'png', 'webp'] as const,
  PathPattern: '{userId}/nutrition/{timestamp}.jpg',
} as const;

export const AIAnalysisRules = {
  TimeoutMs: 30_000,
  DefaultModel: 'gemini-2.5-flash',
} as const;

export const CalorieGoalRules = {
  Min: 1,        // 1 kcal (sentinel for very low goal)
  Max: 10000,    // 10000 kcal upper safety bound
  RecommendedFemale: 1800,
  RecommendedMale: 2500,
  DeficitForWeightLoss: 500,  // max safe daily deficit
} as const;

// === HYDRATION INVARIANTS ===
export const HydrationRules = {
  MinDailyLiters: 2.0,      // 2L minimum per day (general health)
  RecommendedDailyLiters: 3.0,  // 3L recommended for active people
  MaxDailyLiters: 6.0,      // 6L upper bound (water intoxication risk)
  PerKgBodyWeight: 0.033,   // 33ml per kg body weight (sports nutrition)
  PerWorkoutMinute: 0.5,    // 500ml per hour of workout (sports nutrition)
  CupsPerLiter: 4,           // 1 liter = 4 cups (250ml each)
  ReminderIntervalHours: 2,  // reminder to drink every 2 hours
} as const;

// === MACRO NUTRIENT INVARIANTS ===
export const MacroRules = {
  // Protein (g per kg body weight)
  ProteinMinPerKg: 1.2,       // sedentary baseline (RDA)
  ProteinRecommendedPerKg: 1.6, // active people
  ProteinHighPerKg: 2.2,      // athletes / muscle building
  ProteinMaxPerKg: 3.0,        // upper safety bound

  // Fat (% of daily calories)
  FatMinPercent: 20,        // minimum for hormone production
  FatRecommendedPercent: 30,
  FatMaxPercent: 40,        // upper bound (heart health)

  // Carbs (% of daily calories)
  CarbsMinPercent: 30,      // minimum for brain function
  CarbsRecommendedPercent: 45,
  CarbsMaxPercent: 65,

  // Fiber (g per day)
  FiberMinGrams: 25,        // women
  FiberRecommendedGrams: 30,
  FiberMaxGrams: 50,        // upper bound (digestive issues)

  // Sugar limits (% of daily calories)
  AddedSugarMaxPercent: 10,  // WHO recommendation
  AddedSugarMaxGrams: 50,   // WHO: 25-50g per day max

  // Sodium (mg per day)
  SodiumMaxMg: 2300,        // WHO / FDA recommendation
  SodiumIdealMg: 1500,      // ideal for active people

  // Saturated fat (% of daily calories)
  SaturatedFatMaxPercent: 10,
} as const;

// === FOOD QUALITY INVARIANTS ===
export const FoodQualityRules = {
  // Junk food limits (categories flagged as low nutrition)
  JunkFoodCategories: ['soda', 'candy', 'chips', 'fast_food', 'pastries'] as const,
  MaxJunkFoodEntriesPerDay: 1,        // at most 1 junk food entry per day
  MaxJunkFoodEntriesPerWeek: 3,        // at most 3 per week
  MaxJunkFoodCaloriesPerDay: 300,     // 300 kcal from junk food max per day
  JunkFoodCaloriesRatioMax: 0.15,     // max 15% of daily calories from junk

  // Whole foods (encouraged)
  WholeFoodCategories: ['vegetables', 'fruits', 'whole_grains', 'lean_protein', 'nuts', 'seeds'] as const,
  MinWholeFoodEntriesPerDay: 2,       // at least 2 whole food entries per day

  // Meal composition
  MinFoodItemsPerEntry: 1,
  RecommendedFoodItemsPerEntry: 3,    // encourage variety
  MaxFoodItemsPerEntry: 8,

  // Single-nutrient prevention (can't live on only one food group)
  MaxCaloriesFromSingleSourcePercent: 50,  // no more than 50% calories from one food
  MinFoodCategoriesPerDay: 4,              // at least 4 different food groups per day
} as const;

// === MEAL TIMING INVARIANTS ===
export const MealTimingRules = {
  MinMealsPerDay: 2,
  RecommendedMealsPerDay: 4,
  MaxMealsPerDay: 7,
  MinHoursBetweenMeals: 2,         // avoid binging
  RecommendedHoursBetweenMeals: 3,
  MinHoursBeforeBedtime: 2,         // no eating right before sleep
  MinHoursAfterWorkout: 0.5,       // eat within 30 min after workout
  RecommendedHoursAfterWorkout: 1, // ideal anabolic window
} as const;

// === CALORIE BURN BALANCE INVARIANTS ===
export const CalorieBalanceRules = {
  // Caloric deficit safety (for weight loss)
  MinDailyCalories: 1200,        // never go below 1200 (women) / 1500 (men)
  MinDailyCaloriesMale: 1500,
  MinDailyCaloriesFemale: 1200,

  // Weekly balance
  MaxWeeklyDeficit: 3500,        // max 3500 kcal deficit per week (0.5kg/week)
  MaxWeeklySurplus: 3500,        // max 3500 kcal surplus per week (0.5kg/week)

  // Burn ratio (workout calories vs consumed)
  MinWorkoutBurnRatio: 0.05,      // at least 5% of calories burned through exercise
  MaxCalorieIntakeVsBurn: 2.0,    // can't eat more than 2x what's burned
} as const;

export const NutritionBucket = {
  Name: 'nutrition-photos',
  PathPattern: '{userId}/nutrition/{timestamp}.jpg',
} as const;
```

### Entities

- `NutritionEntry` — one analyzed meal. Has `id`, `user_id`, `photo_path`, `photo_date`, `total_calories`, `total_protein`, `total_carbs`, `total_fat`, `food_items`, `ai_raw_response`, `user_edited`, `created_at`.
- `FoodItem` — one identified food. Has `name`, `estimated_calories`, `estimated_protein`, `estimated_carbs`, `estimated_fat`.
- `NutritionGoal` — daily calorie target. Has `user_id`, `daily_calorie_goal`.

### Value Objects

- `Calories` — positive integer, in kcal.
- `Macros` — value object: `{ protein: number, carbs: number, fat: number }` in grams.
- `FoodItemsList` — array of FoodItem. Must have ≥ 1 item.
- `PhotoFile` — image file, max `PhotoRules.MaxSizeBytes` (5MB), formats per `PhotoRules.AcceptedFormats`.
- `Hydration` — daily water intake in liters. Must be in [`HydrationRules.MinDailyLiters`, `HydrationRules.MaxDailyLiters`].

### Invariants

#### Data integrity invariants
- `total_calories` MUST be ≥ 0.
- `total_protein`, `total_carbs`, `total_fat` MUST be ≥ 0.
- `food_items` MUST have ≥ `FoodQualityRules.MinFoodItemsPerEntry` (1) item.
- Each FoodItem MUST have `name` (non-empty) and `estimated_calories` (≥ 0).
- Max `PhotoRules.MaxSizeBytes` (5MB) per photo. Hard limit.
- Accepted formats per `PhotoRules.AcceptedFormats`: jpg, png, webp only.
- AI analysis timeout at `AIAnalysisRules.TimeoutMs` (30 seconds).
- If AI cannot identify food → return error, do not save entry.
- User CAN edit AI estimates before saving. `user_edited` flag tracks this.
- `daily_calorie_goal` MUST be null or integer in range [`CalorieGoalRules.Min`, `CalorieGoalRules.Max`].
- Daily calorie sum = sum of all `NutritionEntry.total_calories` for current day.
- Nutrition entries are PRIVATE. Only owner can view. Not visible in public view.

#### Hydration invariants
- Daily water intake MUST be ≥ `HydrationRules.MinDailyLiters` (2L). Health minimum.
- Daily water intake SHOULD be ≥ `HydrationRules.RecommendedDailyLiters` (3L). Recommended for active users.
- Daily water intake MUST NOT exceed `HydrationRules.MaxDailyLiters` (6L). Water intoxication risk.
- Water intake scales with body weight: `HydrationRules.PerKgBodyWeight` (33ml) per kg. Used as recommendation, not hard rule.
- Additional water after workout: `HydrationRules.PerWorkoutMinute` (500ml/hour). Recommendation.
- Reminders to drink water every `HydrationRules.ReminderIntervalHours` (2h) hours.

#### Macronutrient balance invariants
- Protein intake MUST be ≥ `MacroRules.ProteinMinPerKg` (1.2g) per kg body weight. RDA baseline.
- Protein intake SHOULD be in range [`MacroRules.ProteinRecommendedPerKg`, `MacroRules.ProteinHighPerKg`] = [1.6, 2.2] g per kg for active people.
- Protein intake MUST NOT exceed `MacroRules.ProteinMaxPerKg` (3g) per kg. Kidney stress.
- Fat intake MUST be ≥ `MacroRules.FatMinPercent` (20%) of daily calories. Hormone production.
- Fat intake SHOULD be ~`MacroRules.FatRecommendedPercent` (30%) of daily calories.
- Fat intake MUST NOT exceed `MacroRules.FatMaxPercent` (40%) of daily calories. Heart health.
- Carb intake MUST be ≥ `MacroRules.CarbsMinPercent` (30%) of daily calories. Brain function.
- Carb intake SHOULD be ~`MacroRules.CarbsRecommendedPercent` (45%) of daily calories.
- Carb intake MUST NOT exceed `MacroRules.CarbsMaxPercent` (65%) of daily calories.
- Fiber intake MUST be ≥ `MacroRules.FiberMinGrams` (25g) per day.
- Fiber intake SHOULD be ≥ `MacroRules.FiberRecommendedGrams` (30g) per day.
- Fiber intake MUST NOT exceed `MacroRules.FiberMaxGrams` (50g) per day.
- Added sugar MUST be ≤ `MacroRules.AddedSugarMaxPercent` (10%) of daily calories (WHO).
- Added sugar MUST be ≤ `MacroRules.AddedSugarMaxGrams` (50g) per day (WHO).
- Sodium intake MUST be ≤ `MacroRules.SodiumMaxMg` (2300mg) per day.
- Saturated fat MUST be ≤ `MacroRules.SaturatedFatMaxPercent` (10%) of daily calories.

#### Food quality invariants
- Junk food entries per day MUST NOT exceed `FoodQualityRules.MaxJunkFoodEntriesPerDay` (1).
- Junk food entries per week MUST NOT exceed `FoodQualityRules.MaxJunkFoodEntriesPerWeek` (3).
- Junk food calories per day MUST NOT exceed `FoodQualityRules.MaxJunkFoodCaloriesPerDay` (300 kcal).
- Junk food ratio MUST NOT exceed `FoodQualityRules.JunkFoodCaloriesRatioMax` (15%) of daily calories. Warning shown.
- Whole food entries per day MUST be ≥ `FoodQualityRules.MinWholeFoodEntriesPerDay` (2). Diversity encouragement.
- Each entry SHOULD have ~`FoodQualityRules.RecommendedFoodItemsPerEntry` (3) food items. Variety.
- Max `FoodQualityRules.MaxFoodItemsPerEntry` (8) items per entry.
- No single food source MUST exceed `FoodQualityRules.MaxCaloriesFromSingleSourcePercent` (50%) of daily calories. Prevents single-food diets.
- User MUST consume ≥ `FoodQualityRules.MinFoodCategoriesPerDay` (4) different food groups per day. Prevents junk-only diets.
- User CANNOT have 0 vegetable or fruit entries per day for > 3 consecutive days. Warning shown.

#### Meal timing invariants
- User MUST have ≥ `MealTimingRules.MinMealsPerDay` (2) entries per day.
- User SHOULD aim for `MealTimingRules.RecommendedMealsPerDay` (4) entries per day.
- User MUST NOT have > `MealTimingRules.MaxMealsPerDay` (7) entries per day.
- Min `MealTimingRules.MinHoursBetweenMeals` (2) hours between consecutive meals.
- Recommended `MealTimingRules.RecommendedHoursBetweenMeals` (3) hours between meals.
- No entries within `MealTimingRules.MinHoursBeforeBedtime` (2) hours of typical sleep time.
- Post-workout meal within `MealTimingRules.RecommendedHoursAfterWorkout` (1) hour of workout completion. Anabolic window.

#### Caloric balance invariants
- Daily calories MUST be ≥ `CalorieBalanceRules.MinDailyCalories` (1200) for females / `CalorieBalanceRules.MinDailyCaloriesMale` (1500) for males. Starvation prevention.
- Weekly caloric deficit MUST NOT exceed `CalorieBalanceRules.MaxWeeklyDeficit` (3500 kcal). Safe weight loss (0.5kg/week).
- Weekly caloric surplus MUST NOT exceed `CalorieBalanceRules.MaxWeeklySurplus` (3500 kcal). Safe weight gain.
- Workout burn ratio MUST be ≥ `CalorieBalanceRules.MinWorkoutBurnRatio` (5%) of consumed calories. Encourages exercise.
- Calorie intake MUST NOT exceed `CalorieBalanceRules.MaxCalorieIntakeVsBurn` (2x) calories burned. Sedentary lifestyle prevention.
- User cannot eat calories without any workout burn for > 7 consecutive days. Warning shown.

### Ports

- `NutritionEntryRepository` — create, getByUserId, getByDate, delete.
- `NutritionGoalRepository` — getGoal, setGoal.
- `AIAnalysisPort` — analyzePhoto(imageData): AIAnalysisResult.

---

## Application

### Use Cases

| Use case | Purpose | Status |
|----------|---------|--------|
| AnalyzeMealUseCase | Send photo to AI, get calorie/macro estimates | planned |
| SaveNutritionEntryUseCase | Save analyzed meal (with optional user edits) | planned |
| GetNutritionHistoryUseCase | Fetch user's nutrition entries | planned |
| GetDailyCalorieSummaryUseCase | Sum today's calories vs goal | planned |
| SetCalorieGoalUseCase | Set daily calorie goal | planned |

### Orchestration

1. `AnalyzeMealUseCase`:
   - Validate photo: format (jpg/png/webp), size ≤ 5MB.
   - Compress client-side.
   - Call `AIAnalysisPort.analyzePhoto(compressedImageData)`.
   - AI returns: `{ total_calories, total_protein, total_carbs, total_fat, food_items[] }`.
   - If AI fails → return error "Food not recognized. Try a clearer photo."
   - Return analysis result (not yet saved).

2. `SaveNutritionEntryUseCase`:
   - Receive analysis result + optional user edits.
   - Upload photo to storage: `{userId}/nutrition/{timestamp}.jpg`.
   - Call `NutritionEntryRepository.create({ user_id, photo_path, total_calories, ... })`.
   - Return saved entry.

3. `GetDailyCalorieSummaryUseCase`:
   - Call `NutritionEntryRepository.getByDate(userId, today)`.
   - Sum `total_calories` for all entries today.
   - Call `NutritionGoalRepository.getGoal(userId)`.
   - Return `{ consumed, goal, remaining }`.

---

## Infrastructure

Per [ADR-007](../decisions/007-repository-pattern.md) and [ADR-011](../decisions/011-implements-not-extends.md).

### Abstract Classes (Contracts)

```ts
// src/lib/contexts/nutrition/domain/ports/nutrition-entry-repository.ts
abstract class NutritionEntryRepository {
  abstract create(data: NutritionEntryCreateDTO): Promise<NutritionEntry>;
  abstract getByUserId(userId: string): Promise<NutritionEntry[]>;
  abstract getByDate(userId: string, date: string): Promise<NutritionEntry[]>;
  abstract delete(id: string): Promise<void>;
}

// src/lib/contexts/nutrition/domain/ports/nutrition-goal-repository.ts
abstract class NutritionGoalRepository {
  abstract getGoal(userId: string): Promise<number | null>;
  abstract setGoal(userId: string, goal: number | null): Promise<void>;
}

// src/lib/contexts/nutrition/domain/ports/ai-analysis.port.ts
abstract class AIAnalysisPort {
  abstract analyzePhoto(imageData: string): Promise<AIAnalysisResult>;
}
```

### Supabase Implementation (Production)

```ts
// src/lib/contexts/nutrition/infrastructure/supabase/supabase-nutrition-entry.repository.ts
class SupabaseNutritionEntryRepository implements NutritionEntryRepository {
  constructor(private supabase: SupabaseClient) {}

  async create(data: NutritionEntryCreateDTO): Promise<NutritionEntry> {
    const { data: row, error } = await this.supabase
      .from('nutrition_entries')
      .insert({ user_id: data.user_id, photo_path: data.photo_path, total_calories: data.total_calories, total_protein: data.total_protein, total_carbs: data.total_carbs, total_fat: data.total_fat, food_items: data.food_items, ai_raw_response: data.ai_raw_response, user_edited: data.user_edited })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  }

  async getByDate(userId: string, date: string): Promise<NutritionEntry[]> {
    const { data, error } = await this.supabase
      .from('nutrition_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`);
    if (error) throw new Error(error.message);
    return data;
  }
}
```

### SQLite Implementation (Tests, E2E)

```ts
// src/lib/contexts/nutrition/infrastructure/sqlite/sqlite-nutrition-entry.repository.ts
class SqliteNutritionEntryRepository implements NutritionEntryRepository {
  constructor(private db: Database) {}

  async create(data: NutritionEntryCreateDTO): Promise<NutritionEntry> {
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO nutrition_entries (id, user_id, photo_path, total_calories, total_protein, total_carbs, total_fat, food_items, ai_raw_response, user_edited, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, data.user_id, data.photo_path, data.total_calories, data.total_protein, data.total_carbs, data.total_fat, JSON.stringify(data.food_items), JSON.stringify(data.ai_raw_response), data.user_edited ? 1 : 0);
    return this.getById(id);
  }

  async getByDate(userId: string, date: string): Promise<NutritionEntry[]> {
    return this.db.prepare(`
      SELECT * FROM nutrition_entries
      WHERE user_id = ? AND date(created_at) = ?
    `).all(userId, date);
  }
}
```

### AI Provider Implementations

```ts
// src/lib/contexts/nutrition/infrastructure/ai/gemini-vision.adapter.ts
class GeminiVisionAdapter implements AIAnalysisPort {
  constructor(private apiKey: string) {}

  async analyzePhoto(imageData: string): Promise<AIAnalysisResult> {
    const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + this.apiKey, {
      method: 'POST',
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Analyze this food photo. Return JSON with total_calories, total_protein, total_carbs, total_fat, food_items.' }, { inline_data: { mime_type: 'image/jpeg', data: imageData } }] }]
      })
    });
    const result = await response.json();
    return parseGeminiResponse(result);
  }
}
```

### Wiring (Per-Context Composition)

Per [ADR-010](../decisions/010-per-context-composition.md), no central root. See `nutrition.composition.ts` below.

---

## Per-Context Composition

Per [ADR-010](../decisions/010-per-context-composition.md), no central root.

`src/lib/contexts/nutrition/nutrition.composition.ts`:

```ts
import { useSupabase, supabaseClient, sqliteDb } from '@/lib/config';
import { SupabaseNutritionEntryRepository } from './infrastructure/supabase/SupabaseNutritionEntryRepository';
import { SqliteNutritionEntryRepository } from './infrastructure/sqlite/SqliteNutritionEntryRepository';
import { SupabaseNutritionGoalRepository } from './infrastructure/supabase/SupabaseNutritionGoalRepository';
import { SqliteNutritionGoalRepository } from './infrastructure/sqlite/SqliteNutritionGoalRepository';
import { GeminiVisionAdapter } from './infrastructure/ai/GeminiVisionAdapter';
import { AnalyzeMealUseCase } from './application/AnalyzeMealUseCase';
import { SaveNutritionEntryUseCase } from './application/SaveNutritionEntryUseCase';
import { GetDailyCalorieSummaryUseCase } from './application/GetDailyCalorieSummaryUseCase';

const nutritionRepo = useSupabase
  ? new SupabaseNutritionEntryRepository(supabaseClient)
  : new SqliteNutritionEntryRepository(sqliteDb);

const goalRepo = useSupabase
  ? new SupabaseNutritionGoalRepository(supabaseClient)
  : new SqliteNutritionGoalRepository(sqliteDb);

const aiAdapter = new GeminiVisionAdapter(process.env.GEMINI_API_KEY!);

export const analyzeMealUseCase = new AnalyzeMealUseCase(aiAdapter);
export const saveNutritionEntryUseCase = new SaveNutritionEntryUseCase(nutritionRepo);
export const getDailyCalorieSummaryUseCase = new GetDailyCalorieSummaryUseCase(nutritionRepo, goalRepo);
```

---

## UI

### Components

- `MealPhotoCapture` — camera/file picker + compression.
- `NutritionResult` — calories, macros breakdown, food items list, edit option.
- `DailyCalorieBar` — progress bar showing consumed vs goal.
- `NutritionHistory` — list of past meals with thumbnails.

### Interactive components (Astro islands)

Per Astro's island architecture, interactive components are hydrated as needed:

- `MealPhotoCapture.svelte` — Svelte island, file picker + compression (lightweight, minimal JS).
- `NutritionResult.svelte` — Svelte island, edit/display macros (simple state).
- `DailyCalorieBar.svelte` — Svelte island, progress bar (minimal logic).

### Pages

- `/nutrition` — SSR, analyze new meal + history.
- `/nutrition/history` — SSR, full history.

---

## Testing

Per [ADR-009](../decisions/009-object-mothers.md), tests use **NO MOCKS** — only real implementations (SQLite repositories) with Object Mothers.

`src/test/contexts/nutrition/AnalyzeMealUseCase.test.ts`:

```ts
import { faker } from '@faker-js/faker';
import { createTestDb } from '@/test/setup';
import { SqliteNutritionEntryRepository } from '@/lib/contexts/nutrition/infrastructure/sqlite/SqliteNutritionEntryRepository';
import { AnalyzeMealUseCase } from '@/lib/contexts/nutrition/application/AnalyzeMealUseCase';
import { GeminiVisionAdapter } from '@/lib/contexts/nutrition/infrastructure/ai/GeminiVisionAdapter';
import { NutritionEntryMother } from '@/test/mothers/NutritionEntryMother';

describe('AnalyzeMealUseCase', () => {
  it('returns analysis from real Gemini API call', async () => {
    const db = createTestDb();
    const repo = new SqliteNutritionEntryRepository(db);
    const ai = new GeminiVisionAdapter(process.env.GEMINI_TEST_API_KEY!);
    const useCase = new AnalyzeMealUseCase(ai);

    // Real API call with real test image
    const imageData = faker.image.dataUri();
    const result = await useCase.execute(imageData);

    expect(result.total_calories).toBeGreaterThan(0);
  });
});
```

Object Mothers in `src/test/mothers/`:

```ts
// NutritionEntryMother.ts
export class NutritionEntryMother {
  static create(overrides = {}): NutritionEntry {
    return {
      id: faker.string.uuid(),
      user_id: faker.string.uuid(),
      photo_path: `/${faker.string.uuid()}/${faker.string.uuid()}.jpg`,
      total_calories: faker.number.int({ min: 100, max: 1000 }),
      total_protein: faker.number.int({ min: 0, max: 100 }),
      total_carbs: faker.number.int({ min: 0, max: 200 }),
      total_fat: faker.number.int({ min: 0, max: 100 }),
      food_items: [{ name: faker.food.dish(), estimated_calories: 500, ... }],
      user_edited: false,
      created_at: faker.date.recent().toISOString(),
      ...overrides,
    };
  }
}
```

---

## Flows

- [analyze-meal.flow.md](./flows/analyze-meal.flow.md)
