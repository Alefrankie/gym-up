---
id: ADR-009
title: Object Mothers Test Pattern with @faker-js/faker
type: decision
status: accepted
date: 2026-07-21
---

# ADR-009: Object Mothers Test Pattern with @faker-js/faker

## Status

Accepted

## Context

Tests need test data. Hardcoding values creates duplication. Mocks hide real behavior. We need a way to create realistic, varied test data without duplication and without mocks.

## Decision

Use the **Object Mother pattern** with `@faker-js/faker` for test data generation. NO mocks — only fakes (real implementations with controlled data).

### Pattern

```ts
// Object Mother per entity
// src/test/mothers/WorkoutMother.ts
import { faker } from '@faker-js/faker';
import { Workout, WorkoutStatus } from '@/lib/contexts/workout-tracking/domain/entities/Workout';

export class WorkoutMother {
  static create(overrides: Partial<Workout> = {}): Workout {
    return {
      id: faker.string.uuid(),
      user_id: faker.string.uuid(),
      routine_day_id: faker.string.uuid(),
      workout_date: faker.date.recent().toISOString().split('T')[0],
      status: 'in_progress' as WorkoutStatus,
      started_at: faker.date.recent().toISOString(),
      completed_at: null,
      ...overrides,
    };
  }

  static completed(overrides: Partial<Workout> = {}): Workout {
    return this.create({ status: 'completed', completed_at: faker.date.recent().toISOString(), ...overrides });
  }

  static inProgress(overrides: Partial<Workout> = {}): Workout {
    return this.create({ status: 'in_progress', ...overrides });
  }

  static list(count: number, overrides: Partial<Workout> = {}): Workout[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}
```

### Usage in Tests

```ts
// src/test/contexts/workout-tracking/StartWorkoutUseCase.test.ts
import { WorkoutMother } from '@/test/mothers/WorkoutMother';
import { SqliteWorkoutRepository } from '@/lib/contexts/workout-tracking/infrastructure/sqlite/SqliteWorkoutRepository';
import { createTestDb } from '@/test/setup';

describe('StartWorkoutUseCase', () => {
  let db: Database;
  let workoutRepo: WorkoutRepository;
  let useCase: StartWorkoutUseCase;

  beforeEach(() => {
    db = createTestDb(); // fresh in-memory SQLite per test
    workoutRepo = new SqliteWorkoutRepository(db);
    useCase = new StartWorkoutUseCase(workoutRepo);
  });

  it('creates an in_progress workout for today', async () => {
    const userId = faker.string.uuid();
    const routineDayId = faker.string.uuid();

    const result = await useCase.execute(userId, routineDayId);

    expect(result.status).toBe('in_progress');
    expect(result.user_id).toBe(userId);
  });
});
```

### NO Mocks Rule

- ❌ **No `jest.fn()`** — no mock functions.
- ❌ **No `vi.mock()`** — no module mocking.
- ❌ **No `mockResolvedValue()`** — no return value mocking.
- ✅ **Only real implementations** — SQLite repositories, real `KeyValueStorage`, real adapters.
- ✅ **Test data via Object Mothers** — realistic, varied, no duplication.

### Fakes vs Mocks

- **Fake**: real implementation with simplified internals. Example: `SqliteWorkoutRepository` is a fake (real SQL, different engine).
- **Mock**: stub that returns hardcoded values. Example: `jest.fn().mockReturnValue(...)` is a mock.

We use **fakes** only. Tests run real code against real (but in-memory) SQLite.

## Rationale

- **Object Mothers** centralize test data creation — no duplication, easy to evolve.
- **@faker-js/faker** generates realistic varied data — no hardcoded `user-1`, `user-2` everywhere.
- **NO mocks** ensures tests catch real bugs, not mock bugs.
- **SQLite fakes** run actual SQL queries — same bugs would appear in production.
- **Per-test fresh DB** — no test pollution, parallel test runs safe.

## Consequence

- Every entity has a `XxxMother` class in `src/test/mothers/`.
- Tests import mothers instead of hardcoding data.
- `createTestDb()` helper creates fresh in-memory SQLite per test.
- No mocking library usage in test code.

## Example Mothers per Entity

| Entity | Mother | Variants |
|--------|--------|----------|
| Profile | `ProfileMother` | `.create()`, `.male()`, `.female()`, `.withCalorieGoal()` |
| Workout | `WorkoutMother` | `.create()`, `.completed()`, `.inProgress()`, `.list(n)` |
| WorkoutEntry | `WorkoutEntryRepository` | `.create()`, `.forExercise(id)`, `.set(n, exerciseId)` |
| ProgressPhoto | `ProgressPhotoMother` | `.create()`, `.withCaption()` |
| NutritionEntry | `NutritionEntryMother` | `.create()`, `.withCalories(n)`, `.userEdited()` |

## Referenced by

- [system.md](../system.md) — testing strategy
- [test setup guide](../testing/) (TODO)
