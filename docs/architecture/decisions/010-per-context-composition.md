---
id: ADR-010
title: Per-Context Composition Files
type: decision
status: accepted
date: 2026-07-21
---

# ADR-010: Per-Context Composition Files

## Status

Accepted

## Context

A single composition root (`container.ts`) for the whole app creates a "big ball of mud" — every context's wiring is in one file. Changes to one context force touching the central file. Hard to test contexts in isolation.

## Decision

Each context has its own composition file: `[context].composition.ts`. This file wires the context's repositories, use cases, and exposes them. No central composition root.

### Pattern

```
src/lib/contexts/
  auth/
    auth.composition.ts          ← wires all auth deps
    domain/
    application/
    infrastructure/
    ui/
  user/
    user.composition.ts
    ...
  workout-tracking/
    workout-tracking.composition.ts
    ...
```

### Example: `auth.composition.ts`

```ts
// src/lib/contexts/auth/auth.composition.ts
import { useSupabase } from '@/lib/config';
import { supabaseClient } from '@/lib/supabase';
import { sqliteDb } from '@/lib/sqlite';

import { SupabaseAuthAdapter } from './infrastructure/supabase/SupabaseAuthAdapter';
import { SqliteAuthAdapter } from './infrastructure/sqlite/SqliteAuthAdapter';

import { AuthPort } from './domain/ports/AuthPort';
import { SessionPort } from './domain/ports/SessionPort';

import { BrowserKeyValueStorage } from '@/lib/storage/BrowserKeyValueStorage';

import { RegisterUserUseCase } from './application/RegisterUserUseCase';
import { LoginUserUseCase } from './application/LoginUserUseCase';
import { LogoutUserUseCase } from './application/LogoutUserUseCase';

// Ports (interfaces) — swapped by env
const authPort: AuthPort = useSupabase
  ? new SupabaseAuthAdapter(supabaseClient)
  : new SqliteAuthAdapter(sqliteDb);

const sessionPort: SessionPort = useSupabase
  ? new SupabaseSessionAdapter(supabaseClient)
  : new SqliteSessionAdapter(sqliteDb);

const kvStorage = useSupabase
  ? new BrowserKeyValueStorage()
  : new SqliteKeyValueStorage(sqliteDb);

// Use cases
export const registerUserUseCase = new RegisterUserUseCase(authPort, kvStorage);
export const loginUserUseCase = new LoginUserUseCase(authPort, sessionPort, kvStorage);
export const logoutUserUseCase = new LogoutUserUseCase(authPort, sessionPort);
```

### Example: `workout-tracking.composition.ts`

```ts
// src/lib/contexts/workout-tracking/workout-tracking.composition.ts
import { useSupabase, supabaseClient, sqliteDb } from '@/lib/config';
import { SqliteWorkoutRepository } from './infrastructure/sqlite/SqliteWorkoutRepository';
import { SupabaseWorkoutRepository } from './infrastructure/supabase/SupabaseWorkoutRepository';
// ... other imports

// Repositories
const workoutRepo: WorkoutRepository = useSupabase
  ? new SupabaseWorkoutRepository(supabaseClient)
  : new SqliteWorkoutRepository(sqliteDb);

const entryRepo: WorkoutEntryRepository = useSupabase
  ? new SupabaseWorkoutEntryRepository(supabaseClient)
  : new SqliteWorkoutEntryRepository(sqliteDb);

const routineRepo: RoutineRepository = useSupabase
  ? new SupabaseRoutineRepository(supabaseClient)
  : new SqliteRoutineRepository(sqliteDb);

const exerciseRepo: ExerciseRepository = useSupabase
  ? new SupabaseExerciseRepository(supabaseClient)
  : new SqliteExerciseRepository(sqliteDb);

const kvStorage = useSupabase
  ? new BrowserKeyValueStorage()
  : new SqliteKeyValueStorage(sqliteDb);

// Use cases
export const startWorkoutUseCase = new StartWorkoutUseCase(workoutRepo, routineRepo);
export const logSetUseCase = new LogSetUseCase(entryRepo, kvStorage);
export const completeWorkoutUseCase = new CompleteWorkoutUseCase(workoutRepo, entryRepo);
```

### Page-Level Usage

```ts
// src/pages/dashboard.astro
---
import { startWorkoutUseCase } from '@/lib/contexts/workout-tracking/workout-tracking.composition';
import { getProfileUseCase } from '@/lib/contexts/user/user.composition';

const user = await getProfileUseCase.execute(currentUserId);
const todayWorkout = await startWorkoutUseCase.getToday(currentUserId);
---
```

## Rationale

- **Per-context file** — changes to one context don't touch others.
- **No central god file** — each context is self-contained.
- **Test isolation** — each context can be tested with its own composition.
- **Bounded contexts** — matches DDD bounded context pattern.
- **Clear ownership** — each context owns its wiring.

## Consequence

- Each context has a `[name].composition.ts` file at the context root.
- No `container.ts` or `composition-root.ts`.
- Shared config (`useSupabase`, `supabaseClient`, `sqliteDb`) imported from `@/lib/config`.
- Pages import use cases from context compositions directly.
- Tests can import compositions and use real implementations.

## Referenced by

- [system.md](../system.md) — composition strategy
- [all contexts](../contexts/) — each has its own composition
